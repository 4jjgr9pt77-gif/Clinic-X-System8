@echo off
title Create Clinic X Desktop Icon
cd /d "%~dp0"

echo.
echo  Creating Clinic X icon on your Desktop...
echo.

set "DESKTOP=%USERPROFILE%\Desktop"
set "APPDIR=%~dp0"
set "TARGET=%APPDIR%Launch-ClinicX.vbs"
set "SHORTCUT=%DESKTOP%\Clinic X.lnk"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT%');" ^
  "$s.TargetPath = 'wscript.exe';" ^
  "$s.Arguments = '\"%TARGET%\"';" ^
  "$s.WorkingDirectory = '%APPDIR%';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'Clinic X - Clinic Management System';" ^
  "$s.IconLocation = '%%SystemRoot%%\System32\shell32.dll,15';" ^
  "$s.Save();" ^
  "Write-Host 'Desktop shortcut created: Clinic X'"

echo.
echo  DONE!
echo  Look on your Desktop for icon:  Clinic X
echo  Double-click it to open the system.
echo.
pause
