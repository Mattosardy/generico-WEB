# \# AGENTS.md

# 

# \# PROJECT RULES

# 

# STACK:

# 

# \* Vite

# \* Vanilla JS

# \* Supabase

# \* Cloudflare Workers

# 

# ARCHITECTURE:

# 

# \* Frontend in root and /js

# \* Workers logic in /workers

# \* Database and SQL in /supabase

# 

# GENERAL RULES:

# 

# \* Never rewrite entire files unless explicitly requested

# \* Use minimal patches

# \* Preserve current architecture

# \* Keep functions modular and small

# \* Avoid unnecessary dependencies

# \* Reuse existing utilities and patterns

# \* Preserve comments and formatting style

# \* Avoid duplicate code

# 

# IMPORTANT:

# 

# \* Do not modify environment files unless requested

# \* Do not touch deployment configs unless requested

# \* Do not change folder structure

# \* Analyze before editing

# \* Explain root cause before applying fixes

# 

# WORKFLOW:

# 

# 1\. Analyze problem

# 2\. Identify root cause

# 3\. Propose minimal fix

# 4\. Apply smallest safe modification

# 5\. Verify compatibility

# 

# DEBUGGING:

# 

# \* Never guess blindly

# \* Prefer logs and exact errors

# \* Avoid speculative changes

# \* Isolate issue before patching

# 

# CONTEXT CONTROL:

# 

# \* Do not scan the whole project unless necessary

# \* Read only files related to the current task

# \* Prefer minimal context usage

# \* Avoid unnecessary file reads

# 

# PROJECT MEMORY:

# 

# Before making changes, read `memories.md`.

# 

# Use `memories.md` only as project history:

# 

# \* previous fixes

# \* known bugs

# \* architecture decisions

# \* deployment notes

# \* Supabase notes

# \* Workers notes

# \* UI/CSS behavior notes

# 

# `memories.md` does NOT override AGENTS.md.

# 

# When discovering:

# 

# \* important fixes

# \* recurring bugs

# \* deployment changes

# \* architectural decisions

# 

# ask before adding a short entry to `memories.md`.

# 

# FILES:

# 

# \* /js

# \* /workers

# \* /supabase

# \* index.html

# \* memories.md

# 

# GIT:

# 

# \* Prefer small commits

# \* Preserve repository structure

# \* Never delete files without confirmation

# 

# FINAL RULE:

# If the request is ambiguous, ask for clarification BEFORE making large changes.

# 

