; W1 Capital — close only processes belonging to the exact install path.
; electron-builder calls this hook instead of showing its default "close the app" prompt.
!macro customCheckAppRunning
  ; Nunca encerrar outros LexisPredict.exe/INFINITUM.exe instalados em pastas diferentes.
  ; PowerShell abaixo é codificado a partir de scripts/close-installed-process.ps1
  ; e verificado byte a byte pela suíte de testes.
  IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 w1_process_close_done
  !insertmacro IS_POWERSHELL_AVAILABLE
  System::Call 'kernel32::SetEnvironmentVariable(t "W1_INSTALL_TARGET_EXE", t "$INSTDIR\${APP_EXECUTABLE_FILENAME}") i .r0'
  ${If} $0 == 0
    SetErrorLevel 2
    Quit
  ${EndIf}
  nsExec::ExecToStack 'powershell.exe -NoProfile -NonInteractive -EncodedCommand IwAgAE4AUwBJAFMAIABvAG4AbAB5ADoAIABnAHIAYQBjAGUAZgB1AGwAbAB5ACAAYwBsAG8AcwBlACAAdABoAGUAIABlAHgAZQBjAHUAdABhAGIAbABlACAAYQB0ACAAdABoAGUAIABlAHgAYQBjAHQAIABpAG4AcwB0AGEAbABsAGEAdABpAG8AbgAgAHAAYQB0AGgALgAKACMAIABOAGUAdgBlAHIAIAB0AGUAcgBtAGkAbgBhAHQAZQAgAGEAbgBvAHQAaABlAHIAIABMAGUAeABpAHMAUAByAGUAZABpAGMAdAAgAG8AcgAgAEMAZQBuAHQAcgBhAGwAIABpAG4AcwB0AGEAbABsAGEAdABpAG8AbgAgAGIAeQAgAGkAbQBhAGcAZQAgAG4AYQBtAGUALgAKACQARQByAHIAbwByAEEAYwB0AGkAbwBuAFAAcgBlAGYAZQByAGUAbgBjAGUAIAA9ACAAJwBTAHQAbwBwACcACgAkAHQAYQByAGcAZQB0ACAAPQAgACQAZQBuAHYAOgBXADEAXwBJAE4AUwBUAEEATABMAF8AVABBAFIARwBFAFQAXwBFAFgARQAKAGkAZgAgACgAWwBzAHQAcgBpAG4AZwBdADoAOgBJAHMATgB1AGwAbABPAHIAVwBoAGkAdABlAFMAcABhAGMAZQAoACQAdABhAHIAZwBlAHQAKQApACAAewAgAGUAeABpAHQAIAA0ACAAfQAKAHQAcgB5ACAAewAgACQAdABhAHIAZwBlAHQAIAA9ACAAWwBJAE8ALgBQAGEAdABoAF0AOgA6AEcAZQB0AEYAdQBsAGwAUABhAHQAaAAoACQAdABhAHIAZwBlAHQAKQAgAH0AIABjAGEAdABjAGgAIAB7ACAAZQB4AGkAdAAgADQAIAB9AAoAJABuAGEAbQBlACAAPQAgAFsASQBPAC4AUABhAHQAaABdADoAOgBHAGUAdABGAGkAbABlAE4AYQBtAGUAVwBpAHQAaABvAHUAdABFAHgAdABlAG4AcwBpAG8AbgAoACQAdABhAHIAZwBlAHQAKQAKAGYAdQBuAGMAdABpAG8AbgAgAEcAZQB0AFQAYQByAGcAZQB0AFAAcgBvAGMAZQBzAHMAIAB7AAoAIAAgAEAAKABHAGUAdAAtAFAAcgBvAGMAZQBzAHMAIAAtAE4AYQBtAGUAIAAkAG4AYQBtAGUAIAAtAEUAcgByAG8AcgBBAGMAdABpAG8AbgAgAFMAaQBsAGUAbgB0AGwAeQBDAG8AbgB0AGkAbgB1AGUAIAB8ACAAVwBoAGUAcgBlAC0ATwBiAGoAZQBjAHQAIAB7AAoAIAAgACAAIAB0AHIAeQAgAHsAIABbAFMAdAByAGkAbgBnAF0AOgA6AEUAcQB1AGEAbABzACgAJABfAC4AUABhAHQAaAAsACAAJAB0AGEAcgBnAGUAdAAsACAAWwBTAHQAcgBpAG4AZwBDAG8AbQBwAGEAcgBpAHMAbwBuAF0AOgA6AE8AcgBkAGkAbgBhAGwASQBnAG4AbwByAGUAQwBhAHMAZQApACAAfQAKACAAIAAgACAAYwBhAHQAYwBoACAAewAgACQAZgBhAGwAcwBlACAAfQAKACAAIAB9ACkACgB9AAoAdAByAHkAIAB7AAoAIAAgACQAaQB0AGUAbQBzACAAPQAgAEAAKABHAGUAdABUAGEAcgBnAGUAdABQAHIAbwBjAGUAcwBzACkACgAgACAAZgBvAHIAZQBhAGMAaAAgACgAJABpAHQAZQBtACAAaQBuACAAJABpAHQAZQBtAHMAKQAgAHsACgAgACAAIAAgAHQAcgB5ACAAewAgAFsAdgBvAGkAZABdACQAaQB0AGUAbQAuAEMAbABvAHMAZQBNAGEAaQBuAFcAaQBuAGQAbwB3ACgAKQAgAH0AIABjAGEAdABjAGgAIAB7ACAAfQAKACAAIAB9AAoAIAAgACQAZABlAGEAZABsAGkAbgBlACAAPQAgAFsARABhAHQAZQBUAGkAbQBlAF0AOgA6AFUAdABjAE4AbwB3AC4AQQBkAGQAUwBlAGMAbwBuAGQAcwAoADIAMAApAAoAIAAgAHcAaABpAGwAZQAgACgAJABpAHQAZQBtAHMALgBDAG8AdQBuAHQAIAAtAGcAdAAgADAAIAAtAGEAbgBkACAAWwBEAGEAdABlAFQAaQBtAGUAXQA6ADoAVQB0AGMATgBvAHcAIAAtAGwAdAAgACQAZABlAGEAZABsAGkAbgBlACkAIAB7AAoAIAAgACAAIABTAHQAYQByAHQALQBTAGwAZQBlAHAAIAAtAE0AaQBsAGwAaQBzAGUAYwBvAG4AZABzACAANgAwADAACgAgACAAIAAgACQAaQB0AGUAbQBzACAAPQAgAEAAKABHAGUAdABUAGEAcgBnAGUAdABQAHIAbwBjAGUAcwBzACkACgAgACAAfQAKACAAIABpAGYAIAAoACQAaQB0AGUAbQBzAC4AQwBvAHUAbgB0ACAALQBnAHQAIAAwACkAIAB7ACAAZQB4AGkAdAAgADIAIAB9AAoAIAAgAGUAeABpAHQAIAAwAAoAfQAgAGMAYQB0AGMAaAAgAHsAIABlAHgAaQB0ACAANAAgAH0ACgA='
  Pop $R0
  Pop $R1
  ${If} $R0 != 0
    ${If} $R0 == 2
      MessageBox MB_OK|MB_ICONSTOP "O aplicativo instalado nesta pasta ainda esta em uso. Feche a versao anterior antes de atualizar; nenhuma outra instalacao foi alterada." /SD IDOK
    ${Else}
      MessageBox MB_OK|MB_ICONSTOP "Nao foi possivel verificar o aplicativo em uso. A instalacao anterior foi preservada." /SD IDOK
    ${EndIf}
    SetErrorLevel 2
    Quit
  ${EndIf}
w1_process_close_done:
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

  ; NSIS /S does not run the assisted finish-page "Run" checkbox.
  ; The Central previously closed, installed silently and never reopened.
  ; This is strictly the signed-update path (--updated), not first-time installs
  ; launched by the Central, avoiding duplicate windows or double startup.
  ${If} ${Silent}
    ${If} ${isUpdated}
      IfFileExists "$INSTDIR\${APP_EXECUTABLE_FILENAME}" 0 w1_updated_restart_done
      ; Start as the logged-in Windows user even when NSIS needed elevation.
      ${StdUtils.ExecShellAsUser} $0 "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "open" ""
w1_updated_restart_done:
    ${EndIf}
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
