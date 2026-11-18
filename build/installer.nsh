; KILL_PROCESS uses the current installer PID in its taskkill filter.
Var pid

; W1 Capital — close only processes belonging to this installation.
; electron-builder calls this hook instead of showing its default "close the app" prompt.
!macro customCheckAppRunning
  System::Call 'kernel32::GetCurrentProcessId() i .r0'
  StrCpy $pid $0
  !insertmacro IS_POWERSHELL_AVAILABLE

  ; First request a normal close, then force-close only if the app is still running.
  !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 0
  Sleep 900
  !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0

  ${if} $R0 == 0
    !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 1
    Sleep 700
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${if} $R0 == 0
      MessageBox MB_OK|MB_ICONSTOP "O Windows ainda está encerrando o W1 Capital. Tente novamente em alguns segundos." /SD IDOK
      SetErrorLevel 2
      Quit
    ${endIf}
  ${endIf}
!macroend

!ifndef BUILD_UNINSTALLER
; The previous uninstaller stages files in its own temporary directory before
; removing the old version. Across volumes this becomes copy-and-delete.
Var updateTemp
!macro customInit
  StrCpy $updateTemp ""
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 w1_temp_done
  ${GetRoot} "$INSTDIR" $0
  ${GetRoot} "$TEMP" $1
  StrCmp $0 $1 w1_temp_done
  ${GetParent} "$INSTDIR" $2
  ClearErrors
  GetTempFileName $3 "$2"
  IfErrors w1_temp_done
  Delete "$3"
  ClearErrors
  CreateDirectory "$3"
  IfErrors w1_temp_done
  StrCpy $updateTemp "$3"
  System::Call 'kernel32::SetEnvironmentVariable(t "TMP", t r3) i .r0'
  System::Call 'kernel32::SetEnvironmentVariable(t "TEMP", t r3) i .r0'
w1_temp_done:
!macroend

!macro customInstall
  ${If} $updateTemp != ""
    RMDir "$updateTemp"
  ${EndIf}
!macroend

; A silent updater cannot acknowledge electron-builder's uninstall error dialog.
!macro w1UninstallResult
  ${If} $R0 != 0
    MessageBox MB_OK|MB_ICONSTOP "$(uninstallFailed): $R0" /SD IDOK
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend

!macro customUnInstallCheck
  !insertmacro w1UninstallResult
!macroend
!macro customUnInstallCheckCurrentUser
  !insertmacro w1UninstallResult
!macroend
!endif
