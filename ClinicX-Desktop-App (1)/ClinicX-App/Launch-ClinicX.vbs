Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
appDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = appDir

' Start server minimized
WshShell.Run "cmd /c node server.js", 0, False

' Wait for server
WScript.Sleep 2000

' Open as app window (Chrome, then Edge)
On Error Resume Next
WshShell.Run "chrome --app=http://localhost:3000 --new-window", 1, False
If Err.Number <> 0 Then
  Err.Clear
  WshShell.Run "msedge --app=http://localhost:3000 --new-window", 1, False
End If
If Err.Number <> 0 Then
  Err.Clear
  WshShell.Run "http://localhost:3000", 1, False
End If
