


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."es_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM socios 
        WHERE email = auth.jwt()->>'email' 
        AND rol IN ('admin', 'maestro')
    );
$$;


ALTER FUNCTION "public"."es_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."es_maestro"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM socios 
        WHERE email = auth.jwt()->>'email' 
        AND rol = 'maestro'
    );
$$;


ALTER FUNCTION "public"."es_maestro"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_socio_id_from_email"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
    SELECT id FROM socios WHERE email = auth.jwt()->>'email' LIMIT 1;
$$;


ALTER FUNCTION "public"."get_socio_id_from_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_socio_id_from_email"("user_email" "text") RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
    SELECT id FROM socios WHERE email = user_email LIMIT 1;
$$;


ALTER FUNCTION "public"."get_socio_id_from_email"("user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    INSERT INTO public.socios (email, nombre, apellido, estado, rol)
    VALUES (
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
        'activo',
        'socio'
    );
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."actividades" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo" "text" NOT NULL,
    "descripcion" "text",
    "fecha" "date" NOT NULL,
    "hora" time without time zone,
    "ubicacion" "text",
    "imagen_url" "text",
    "cupo_maximo" integer,
    "cupos_disponibles" integer,
    "activo" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "tipo" "text" DEFAULT 'actividad'::"text"
);


ALTER TABLE "public"."actividades" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calificaciones_productos" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "producto_id" "uuid",
    "socio_id" "uuid",
    "puntuacion" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "calificaciones_productos_puntuacion_check" CHECK ((("puntuacion" >= 1) AND ("puntuacion" <= 5)))
);


ALTER TABLE "public"."calificaciones_productos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "clave" "text" NOT NULL,
    "valor" "text" NOT NULL,
    "descripcion" "text",
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."configuracion" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."configuracion_sistema" (
    "id" bigint NOT NULL,
    "clave" "text" NOT NULL,
    "valor" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."configuracion_sistema" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."configuracion_sistema_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."configuracion_sistema_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."configuracion_sistema_id_seq" OWNED BY "public"."configuracion_sistema"."id";



CREATE TABLE IF NOT EXISTS "public"."configuracion_whatsapp" (
    "id" bigint NOT NULL,
    "phone_number_id" "text",
    "access_token" "text",
    "business_account_id" "text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."configuracion_whatsapp" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."configuracion_whatsapp_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."configuracion_whatsapp_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."configuracion_whatsapp_id_seq" OWNED BY "public"."configuracion_whatsapp"."id";



CREATE TABLE IF NOT EXISTS "public"."documentos_socios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "socio_id" "uuid",
    "tipo" "text" NOT NULL,
    "archivo_url" "text" NOT NULL,
    "fecha_vencimiento" "date",
    "verificado_por" "uuid",
    "fecha_verificacion" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."documentos_socios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logs_actividad" (
    "id" bigint NOT NULL,
    "usuario_id" "uuid",
    "usuario_email" "text",
    "rol" "text",
    "accion" "text" NOT NULL,
    "tabla_afectada" "text",
    "registro_id" "text",
    "detalles" "jsonb",
    "fecha" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."logs_actividad" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."logs_actividad_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."logs_actividad_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."logs_actividad_id_seq" OWNED BY "public"."logs_actividad"."id";



CREATE TABLE IF NOT EXISTS "public"."lotes_cosecha" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "codigo_lote" "text" NOT NULL,
    "cepa" "text" NOT NULL,
    "fecha_cosecha" "date" NOT NULL,
    "cantidad_gramos_total" integer NOT NULL,
    "cantidad_gramos_disponible" integer NOT NULL,
    "thc_porcentaje" numeric(5,2),
    "cbd_porcentaje" numeric(5,2),
    "fecha_analisis" "date",
    "archivo_analisis_url" "text",
    "estado" "text" DEFAULT 'disponible'::"text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."lotes_cosecha" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."noticias" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "titulo" "text" NOT NULL,
    "contenido" "text" NOT NULL,
    "imagen_url" "text",
    "autor" "text",
    "fecha_publicacion" timestamp without time zone DEFAULT "now"(),
    "destacado" boolean DEFAULT false,
    "activo" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."noticias" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificaciones_programadas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "socio_id" "uuid",
    "tipo" "text" NOT NULL,
    "mensaje" "text" NOT NULL,
    "fecha_programada" timestamp without time zone NOT NULL,
    "fecha_envio" timestamp without time zone,
    "estado" "text" DEFAULT 'pendiente'::"text",
    "canal" "text" DEFAULT 'whatsapp'::"text",
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."notificaciones_programadas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "imagen_url" "text",
    "cepa" "text",
    "thc_porcentaje" numeric(5,2),
    "cbd_porcentaje" numeric(5,2),
    "fecha_cosecha" "date",
    "lote_id" "uuid",
    "disponible" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "activo" boolean DEFAULT true,
    "precio_por_10g" numeric(10,2) DEFAULT 1600
);


ALTER TABLE "public"."productos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."productos_imagenes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "producto_id" "uuid",
    "imagen_url" "text" NOT NULL,
    "orden" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."productos_imagenes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservas_mensuales" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "socio_id" "uuid",
    "mes" integer NOT NULL,
    "año" integer NOT NULL,
    "cantidad_gramos" integer NOT NULL,
    "fecha_retiro" "date" NOT NULL,
    "tipo_entrega" "text" NOT NULL,
    "fecha_confirmacion" timestamp without time zone,
    "estado" "text" DEFAULT 'pendiente'::"text",
    "lote_id" "uuid",
    "peso_real_entregado" integer,
    "entregado_por" "uuid",
    "fecha_entrega_real" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "reservas_mensuales_cantidad_gramos_check" CHECK (("cantidad_gramos" = ANY (ARRAY[20, 40])))
);


ALTER TABLE "public"."reservas_mensuales" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."socios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "numero_socio" integer,
    "nombre" "text" NOT NULL,
    "apellido" "text" NOT NULL,
    "cedula" "text" NOT NULL,
    "telefono" "text" NOT NULL,
    "email" "text",
    "fecha_nacimiento" "date",
    "direccion" "text",
    "fecha_ingreso" "date" DEFAULT CURRENT_DATE,
    "fecha_renovacion" "date",
    "estado" "text" DEFAULT 'pendiente'::"text",
    "activo" boolean DEFAULT true,
    "suspendido_hasta" "date",
    "motivo_suspension" "text",
    "notificacion_whatsapp" boolean DEFAULT true,
    "notificacion_email" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "rol" "text" DEFAULT 'socio'::"text",
    "has_password" boolean DEFAULT false,
    "username" "text"
);


ALTER TABLE "public"."socios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitudes_membresia" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nombre" "text" NOT NULL,
    "apellido" "text" NOT NULL,
    "cedula" "text" NOT NULL,
    "telefono" "text" NOT NULL,
    "email" "text",
    "mensaje" "text",
    "estado" "text" DEFAULT 'pendiente'::"text",
    "fecha_solicitud" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."solicitudes_membresia" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sorteos" (
    "id" bigint NOT NULL,
    "nombre" "text" NOT NULL,
    "descripcion" "text",
    "premio" "text" NOT NULL,
    "fecha_sorteo" "date" NOT NULL,
    "estado" "text" DEFAULT 'activo'::"text",
    "ganador_id" "uuid",
    "fecha_ganador" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "imagen_url" "text"
);


ALTER TABLE "public"."sorteos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sorteos_ganadores" (
    "id" bigint NOT NULL,
    "sorteo_id" bigint,
    "socio_id" "uuid",
    "notificado" boolean DEFAULT false,
    "fecha_notificacion" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sorteos_ganadores" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sorteos_ganadores_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sorteos_ganadores_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sorteos_ganadores_id_seq" OWNED BY "public"."sorteos_ganadores"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."sorteos_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sorteos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sorteos_id_seq" OWNED BY "public"."sorteos"."id";



CREATE TABLE IF NOT EXISTS "public"."sorteos_participantes" (
    "id" bigint NOT NULL,
    "sorteo_id" bigint,
    "socio_id" "uuid",
    "participo" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sorteos_participantes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."sorteos_participantes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."sorteos_participantes_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."sorteos_participantes_id_seq" OWNED BY "public"."sorteos_participantes"."id";



ALTER TABLE ONLY "public"."configuracion_sistema" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."configuracion_sistema_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."configuracion_whatsapp" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."configuracion_whatsapp_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."logs_actividad" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."logs_actividad_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sorteos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sorteos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sorteos_ganadores" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sorteos_ganadores_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."sorteos_participantes" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."sorteos_participantes_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."actividades"
    ADD CONSTRAINT "actividades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calificaciones_productos"
    ADD CONSTRAINT "calificaciones_productos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calificaciones_productos"
    ADD CONSTRAINT "calificaciones_productos_producto_id_socio_id_key" UNIQUE ("producto_id", "socio_id");



ALTER TABLE ONLY "public"."configuracion"
    ADD CONSTRAINT "configuracion_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."configuracion"
    ADD CONSTRAINT "configuracion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."configuracion_sistema"
    ADD CONSTRAINT "configuracion_sistema_clave_key" UNIQUE ("clave");



ALTER TABLE ONLY "public"."configuracion_sistema"
    ADD CONSTRAINT "configuracion_sistema_pkey" PRIMARY KEY ("clave");



ALTER TABLE ONLY "public"."configuracion_whatsapp"
    ADD CONSTRAINT "configuracion_whatsapp_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documentos_socios"
    ADD CONSTRAINT "documentos_socios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logs_actividad"
    ADD CONSTRAINT "logs_actividad_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lotes_cosecha"
    ADD CONSTRAINT "lotes_cosecha_codigo_lote_key" UNIQUE ("codigo_lote");



ALTER TABLE ONLY "public"."lotes_cosecha"
    ADD CONSTRAINT "lotes_cosecha_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."noticias"
    ADD CONSTRAINT "noticias_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificaciones_programadas"
    ADD CONSTRAINT "notificaciones_programadas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos_imagenes"
    ADD CONSTRAINT "productos_imagenes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservas_mensuales"
    ADD CONSTRAINT "reservas_mensuales_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."socios"
    ADD CONSTRAINT "socios_cedula_key" UNIQUE ("cedula");



ALTER TABLE ONLY "public"."socios"
    ADD CONSTRAINT "socios_numero_socio_key" UNIQUE ("numero_socio");



ALTER TABLE ONLY "public"."socios"
    ADD CONSTRAINT "socios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."solicitudes_membresia"
    ADD CONSTRAINT "solicitudes_membresia_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sorteos_ganadores"
    ADD CONSTRAINT "sorteos_ganadores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sorteos_participantes"
    ADD CONSTRAINT "sorteos_participantes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sorteos_participantes"
    ADD CONSTRAINT "sorteos_participantes_sorteo_id_socio_id_key" UNIQUE ("sorteo_id", "socio_id");



ALTER TABLE ONLY "public"."sorteos"
    ADD CONSTRAINT "sorteos_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_actividades_fecha" ON "public"."actividades" USING "btree" ("fecha");



CREATE INDEX "idx_logs_accion" ON "public"."logs_actividad" USING "btree" ("accion");



CREATE INDEX "idx_logs_fecha" ON "public"."logs_actividad" USING "btree" ("fecha" DESC);



CREATE INDEX "idx_logs_usuario" ON "public"."logs_actividad" USING "btree" ("usuario_id");



CREATE INDEX "idx_noticias_fecha" ON "public"."noticias" USING "btree" ("fecha_publicacion");



CREATE INDEX "idx_productos_imagenes_producto_id" ON "public"."productos_imagenes" USING "btree" ("producto_id");



CREATE INDEX "idx_reservas_fecha" ON "public"."reservas_mensuales" USING "btree" ("fecha_retiro");



CREATE INDEX "idx_reservas_socio" ON "public"."reservas_mensuales" USING "btree" ("socio_id");



CREATE INDEX "idx_reservas_socio_id" ON "public"."reservas_mensuales" USING "btree" ("socio_id");



CREATE INDEX "idx_socios_cedula" ON "public"."socios" USING "btree" ("cedula");



CREATE INDEX "idx_socios_email" ON "public"."socios" USING "btree" ("email");



CREATE INDEX "idx_socios_estado" ON "public"."socios" USING "btree" ("estado");



CREATE INDEX "idx_solicitudes_estado" ON "public"."solicitudes_membresia" USING "btree" ("estado");



CREATE INDEX "idx_sorteos_estado" ON "public"."sorteos" USING "btree" ("estado");



CREATE INDEX "idx_sorteos_fecha" ON "public"."sorteos" USING "btree" ("fecha_sorteo");



CREATE INDEX "idx_sorteos_ganadores_sorteo" ON "public"."sorteos_ganadores" USING "btree" ("sorteo_id");



CREATE INDEX "idx_sorteos_participantes_socio" ON "public"."sorteos_participantes" USING "btree" ("socio_id");



CREATE UNIQUE INDEX "socios_username_unique" ON "public"."socios" USING "btree" ("username");



ALTER TABLE ONLY "public"."calificaciones_productos"
    ADD CONSTRAINT "calificaciones_productos_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calificaciones_productos"
    ADD CONSTRAINT "calificaciones_productos_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "public"."socios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documentos_socios"
    ADD CONSTRAINT "documentos_socios_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "public"."socios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notificaciones_programadas"
    ADD CONSTRAINT "notificaciones_programadas_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "public"."socios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos_imagenes"
    ADD CONSTRAINT "productos_imagenes_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."productos"
    ADD CONSTRAINT "productos_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes_cosecha"("id");



ALTER TABLE ONLY "public"."reservas_mensuales"
    ADD CONSTRAINT "reservas_mensuales_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes_cosecha"("id");



ALTER TABLE ONLY "public"."reservas_mensuales"
    ADD CONSTRAINT "reservas_mensuales_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "public"."socios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sorteos_ganadores"
    ADD CONSTRAINT "sorteos_ganadores_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "public"."socios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sorteos_ganadores"
    ADD CONSTRAINT "sorteos_ganadores_sorteo_id_fkey" FOREIGN KEY ("sorteo_id") REFERENCES "public"."sorteos"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sorteos_participantes"
    ADD CONSTRAINT "sorteos_participantes_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "public"."socios"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sorteos_participantes"
    ADD CONSTRAINT "sorteos_participantes_sorteo_id_fkey" FOREIGN KEY ("sorteo_id") REFERENCES "public"."sorteos"("id") ON DELETE CASCADE;



ALTER TABLE "public"."actividades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "actividades_delete_auth" ON "public"."actividades" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "actividades_insert_auth" ON "public"."actividades" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "actividades_select_all" ON "public"."actividades" FOR SELECT USING (true);



CREATE POLICY "actividades_update_auth" ON "public"."actividades" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "calificaciones_insert_own" ON "public"."calificaciones_productos" FOR INSERT WITH CHECK (("socio_id" IN ( SELECT "socios"."id"
   FROM "public"."socios"
  WHERE ("socios"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



ALTER TABLE "public"."calificaciones_productos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calificaciones_select_all" ON "public"."calificaciones_productos" FOR SELECT USING (true);



CREATE POLICY "calificaciones_update_own" ON "public"."calificaciones_productos" FOR UPDATE USING (("socio_id" IN ( SELECT "socios"."id"
   FROM "public"."socios"
  WHERE ("socios"."email" = ("auth"."jwt"() ->> 'email'::"text")))));



CREATE POLICY "config_insert_auth" ON "public"."configuracion_sistema" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "config_select_auth" ON "public"."configuracion_sistema" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "config_update_auth" ON "public"."configuracion_sistema" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."configuracion_sistema" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."configuracion_whatsapp" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "imagenes_all_admin" ON "public"."productos_imagenes" USING ((EXISTS ( SELECT 1
   FROM "public"."socios"
  WHERE (("socios"."email" = ("auth"."jwt"() ->> 'email'::"text")) AND ("socios"."rol" = ANY (ARRAY['admin'::"text", 'maestro'::"text"]))))));



CREATE POLICY "imagenes_select_all" ON "public"."productos_imagenes" FOR SELECT USING (true);



ALTER TABLE "public"."logs_actividad" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "logs_insert_all" ON "public"."logs_actividad" FOR INSERT WITH CHECK (true);



CREATE POLICY "logs_select_auth" ON "public"."logs_actividad" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."noticias" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "noticias_delete_auth" ON "public"."noticias" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "noticias_insert_auth" ON "public"."noticias" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "noticias_select_all" ON "public"."noticias" FOR SELECT USING (true);



CREATE POLICY "noticias_update_auth" ON "public"."noticias" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."notificaciones_programadas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."productos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "productos_delete_auth" ON "public"."productos" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."productos_imagenes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "productos_insert_auth" ON "public"."productos" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "productos_select_all" ON "public"."productos" FOR SELECT USING (true);



CREATE POLICY "productos_update_auth" ON "public"."productos" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "reservas_delete_auth" ON "public"."reservas_mensuales" FOR DELETE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "reservas_insert_auth" ON "public"."reservas_mensuales" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."reservas_mensuales" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reservas_select_auth" ON "public"."reservas_mensuales" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "reservas_update_auth" ON "public"."reservas_mensuales" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."socios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "socios_insert_auth" ON "public"."socios" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "socios_select_auth" ON "public"."socios" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "socios_update_auth" ON "public"."socios" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "solicitudes_insert_all" ON "public"."solicitudes_membresia" FOR INSERT WITH CHECK (true);



ALTER TABLE "public"."solicitudes_membresia" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "solicitudes_select_auth" ON "public"."solicitudes_membresia" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "solicitudes_update_auth" ON "public"."solicitudes_membresia" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "whatsapp_insert_auth" ON "public"."configuracion_whatsapp" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "whatsapp_select_auth" ON "public"."configuracion_whatsapp" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "whatsapp_update_auth" ON "public"."configuracion_whatsapp" FOR UPDATE USING (("auth"."role"() = 'authenticated'::"text"));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."es_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."es_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."es_maestro"() TO "anon";
GRANT ALL ON FUNCTION "public"."es_maestro"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."es_maestro"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_socio_id_from_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_socio_id_from_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_socio_id_from_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_socio_id_from_email"("user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_socio_id_from_email"("user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_socio_id_from_email"("user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON TABLE "public"."actividades" TO "anon";
GRANT ALL ON TABLE "public"."actividades" TO "authenticated";
GRANT ALL ON TABLE "public"."actividades" TO "service_role";



GRANT ALL ON TABLE "public"."calificaciones_productos" TO "anon";
GRANT ALL ON TABLE "public"."calificaciones_productos" TO "authenticated";
GRANT ALL ON TABLE "public"."calificaciones_productos" TO "service_role";



GRANT ALL ON TABLE "public"."configuracion" TO "anon";
GRANT ALL ON TABLE "public"."configuracion" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracion" TO "service_role";



GRANT ALL ON TABLE "public"."configuracion_sistema" TO "anon";
GRANT ALL ON TABLE "public"."configuracion_sistema" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracion_sistema" TO "service_role";



GRANT ALL ON SEQUENCE "public"."configuracion_sistema_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."configuracion_sistema_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."configuracion_sistema_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."configuracion_whatsapp" TO "anon";
GRANT ALL ON TABLE "public"."configuracion_whatsapp" TO "authenticated";
GRANT ALL ON TABLE "public"."configuracion_whatsapp" TO "service_role";



GRANT ALL ON SEQUENCE "public"."configuracion_whatsapp_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."configuracion_whatsapp_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."configuracion_whatsapp_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."documentos_socios" TO "anon";
GRANT ALL ON TABLE "public"."documentos_socios" TO "authenticated";
GRANT ALL ON TABLE "public"."documentos_socios" TO "service_role";



GRANT ALL ON TABLE "public"."logs_actividad" TO "anon";
GRANT ALL ON TABLE "public"."logs_actividad" TO "authenticated";
GRANT ALL ON TABLE "public"."logs_actividad" TO "service_role";



GRANT ALL ON SEQUENCE "public"."logs_actividad_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."logs_actividad_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."logs_actividad_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lotes_cosecha" TO "anon";
GRANT ALL ON TABLE "public"."lotes_cosecha" TO "authenticated";
GRANT ALL ON TABLE "public"."lotes_cosecha" TO "service_role";



GRANT ALL ON TABLE "public"."noticias" TO "anon";
GRANT ALL ON TABLE "public"."noticias" TO "authenticated";
GRANT ALL ON TABLE "public"."noticias" TO "service_role";



GRANT ALL ON TABLE "public"."notificaciones_programadas" TO "anon";
GRANT ALL ON TABLE "public"."notificaciones_programadas" TO "authenticated";
GRANT ALL ON TABLE "public"."notificaciones_programadas" TO "service_role";



GRANT ALL ON TABLE "public"."productos" TO "anon";
GRANT ALL ON TABLE "public"."productos" TO "authenticated";
GRANT ALL ON TABLE "public"."productos" TO "service_role";



GRANT ALL ON TABLE "public"."productos_imagenes" TO "anon";
GRANT ALL ON TABLE "public"."productos_imagenes" TO "authenticated";
GRANT ALL ON TABLE "public"."productos_imagenes" TO "service_role";



GRANT ALL ON TABLE "public"."reservas_mensuales" TO "anon";
GRANT ALL ON TABLE "public"."reservas_mensuales" TO "authenticated";
GRANT ALL ON TABLE "public"."reservas_mensuales" TO "service_role";



GRANT ALL ON TABLE "public"."socios" TO "anon";
GRANT ALL ON TABLE "public"."socios" TO "authenticated";
GRANT ALL ON TABLE "public"."socios" TO "service_role";



GRANT ALL ON TABLE "public"."solicitudes_membresia" TO "anon";
GRANT ALL ON TABLE "public"."solicitudes_membresia" TO "authenticated";
GRANT ALL ON TABLE "public"."solicitudes_membresia" TO "service_role";



GRANT ALL ON TABLE "public"."sorteos" TO "anon";
GRANT ALL ON TABLE "public"."sorteos" TO "authenticated";
GRANT ALL ON TABLE "public"."sorteos" TO "service_role";



GRANT ALL ON TABLE "public"."sorteos_ganadores" TO "anon";
GRANT ALL ON TABLE "public"."sorteos_ganadores" TO "authenticated";
GRANT ALL ON TABLE "public"."sorteos_ganadores" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sorteos_ganadores_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sorteos_ganadores_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sorteos_ganadores_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sorteos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sorteos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sorteos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."sorteos_participantes" TO "anon";
GRANT ALL ON TABLE "public"."sorteos_participantes" TO "authenticated";
GRANT ALL ON TABLE "public"."sorteos_participantes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."sorteos_participantes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."sorteos_participantes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."sorteos_participantes_id_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







