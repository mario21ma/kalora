@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Instaliraj Node.js 24 LTS s https://nodejs.org/ pa ponovno pokreni ovu datoteku.
 pause
 exit /b 1
)
if not exist node_modules (
 call npx --yes pnpm@11.25.0 install --no-frozen-lockfile
 if errorlevel 1 (
  echo Instalacija nije uspjela. Provjeri internetsku vezu i verziju Node.js.
  pause
  exit /b 1
 )
)
echo Kad pise Ready, otvori http://localhost:3000 u pregledniku.
call npx --yes pnpm@11.25.0 dev
pause
