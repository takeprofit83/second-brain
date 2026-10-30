$Action = New-ScheduledTaskAction -Execute "C:\Users\takep\AppData\Local\Programs\Python\Python312\pythonw.exe" -Argument "D:\YandexDisk\Atlas\second-brain\tools\watchdog.py"
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 20)
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "AtlasSecondBrainWatchdog" -Action $Action -Trigger $Trigger -Settings $Settings -Description "Autonomous AI-OS background sync watchdog for Second Brain" -Force
