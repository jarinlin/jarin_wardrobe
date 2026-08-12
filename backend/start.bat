@echo off
cd /d %~dp0
echo Building...
go build -o bin\server.exe .\cmd\server
if errorlevel 1 exit /b 1
echo Starting Jarin wardrobe Go API...
bin\server.exe
