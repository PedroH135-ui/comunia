@echo off
cd /d "%~dp0"
node scripts/start-local.mjs
if errorlevel 1 (
 echo Nao foi possivel iniciar o aplicativo. Veja README.md.
 pause
 exit /b 1
)
start "ComunIA" "http://127.0.0.1:3001"
