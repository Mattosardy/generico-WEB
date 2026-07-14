[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$target = 'T3-420-DEMO-ADMIN'

Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class T3420CredentialReader
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct Credential
    {
        public uint Flags;
        public uint Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public uint CredentialBlobSize;
        public IntPtr CredentialBlob;
        public uint Persist;
        public uint AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CredRead(string target, uint type, uint flags, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", SetLastError = true)]
    private static extern void CredFree(IntPtr buffer);

    public static string[] Read(string target)
    {
        IntPtr pointer;
        if (!CredRead(target, 1, 0, out pointer))
            throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());

        try
        {
            var credential = (Credential)Marshal.PtrToStructure(pointer, typeof(Credential));
            var username = Marshal.PtrToStringUni(credential.UserName) ?? "";
            var password = Marshal.PtrToStringUni(
                credential.CredentialBlob,
                (int)credential.CredentialBlobSize / 2
            ) ?? "";
            return new[] { username, password };
        }
        finally
        {
            CredFree(pointer);
        }
    }
}
'@

$credential = [T3420CredentialReader]::Read($target)
Write-Host 'Credencial local de la demo (no compartir ni guardar en el repositorio):'
Write-Host "Telefono: $($credential[0])"
Write-Host "Contrasena temporal: $($credential[1])"
