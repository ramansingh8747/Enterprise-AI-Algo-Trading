' Windows Script Host file to silently run start-all.ps1 in background without console window popup
Set objFSO = CreateObject("Scripting.FileSystemObject")
Set objShell = CreateObject("WScript.Shell")

strScriptDir = objFSO.GetParentFolderName(WScript.ScriptFullName)
strProjectRoot = objFSO.GetParentFolderName(strScriptDir)
strPsScript = objFSO.BuildPath(strScriptDir, "start-all.ps1")

objShell.CurrentDirectory = strProjectRoot

' Run PowerShell hidden (0 = hide window, false = don't wait for completion)
strCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strPsScript & """"
objShell.Run strCommand, 0, False
