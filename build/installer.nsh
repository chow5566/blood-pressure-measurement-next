; 自定义 NSIS 安装脚本
; 目标：安装时选择「数据存储目录」，写入注册表，供应用首次启动读取。
; 详细设计见 docs/10-storage-and-migration.md §4
;
; 说明：应用以普通权限运行；安装程序为 perMachine（管理员），可写 HKLM。
;
; 注意：customPageAfterChangeDir 处于「页面定义」上下文，只能声明 Page，
; 运行时代码（nsDialogs / MUI_HEADER_TEXT）必须放在 Function 中。

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

Var DataDir
Var DataDirInput
Var DataDirBrowse

!define DATADIR_REG_KEY "Software\skzxsci\blood-pressure-measurement"

; 在「选择安装目录」之后插入自定义页面
!macro customPageAfterChangeDir
  Page custom DataDirPageCreate DataDirPageLeave
!macroend

Function DataDirPageCreate
  !insertmacro MUI_HEADER_TEXT "选择数据存储目录" "请选择业务数据（数据库、图片）的保存位置。"
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 28u "建议选择剩余空间充足的本地磁盘（如 D:\）。应用与数据分开存放，便于后续迁移。"
  Pop $0

  ${NSD_CreateDirRequest} 0 34u 100% 14u "$COMMONAPPDATA\blood-pressure-measurement\data"
  Pop $DataDirInput

  ${NSD_CreateBrowseButton} 0 54u 100% 14u "浏览..."
  Pop $DataDirBrowse
  ${NSD_OnClick} $DataDirBrowse onDataDirBrowse

  nsDialogs::Show
FunctionEnd

Function DataDirPageLeave
  ${NSD_GetText} $DataDirInput $DataDir
FunctionEnd

Function onDataDirBrowse
  ${NSD_GetText} $DataDirInput $0
  nsDialogs::SelectFolderDialog "选择数据存储目录" "$0"
  Pop $1
  ${If} $1 != error
    ${NSD_SetText} $DataDirInput "$1"
  ${EndIf}
FunctionEnd

!macro customInstall
  ${If} $DataDir != ""
    WriteRegStr SHCTX "${DATADIR_REG_KEY}" "DataDir" "$DataDir"
  ${EndIf}
!macroend

!macro customUnInstall
  ; 卸载时保留业务数据目录，避免误删现场数据；仅清理安装器写入的注册表项
  DeleteRegValue SHCTX "${DATADIR_REG_KEY}" "DataDir"
!macroend
