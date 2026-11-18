; Electron Builder's KILL_PROCESS fallback excludes the installer PID.
; The uninstaller build does not include the app-running hook, so avoid an
; unused-variable warning when electron-builder compiles BUILD_UNINSTALLER.
!ifndef BUILD_UNINSTALLER
  Var pid
!endif

; W1 Capital — close only processes belonging to this installation.
; electron-builder calls this hook instead of showing its default "close the app" prompt.
!macro customCheckAppRunning
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
      MessageBox MB_OK|MB_ICONSTOP "O Windows ainda está encerrando o W1 Capital. Tente novamente em alguns segundos."
      SetErrorLevel 2
      Quit
    ${endIf}
  ${endIf}
!macroend
