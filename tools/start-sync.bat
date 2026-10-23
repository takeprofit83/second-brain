@echo off
title Second Brain Auto-Sync
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-watch.ps1"
pause
