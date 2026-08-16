// 首启向导页逻辑（无构建步骤，原生 JS）
const apiKey = document.getElementById('api-key')
const workspace = document.getElementById('workspace')
const pick = document.getElementById('pick')
const submit = document.getElementById('submit')
const errorBox = document.getElementById('error')

const showError = (msg) => {
  errorBox.textContent = msg
  errorBox.hidden = false
}

pick.addEventListener('click', async () => {
  const dir = await window.dshDesktop.wizard.pickWorkspace()
  if (dir) workspace.value = dir
})

submit.addEventListener('click', async () => {
  errorBox.hidden = true
  submit.disabled = true
  submit.textContent = '保存中…'
  try {
    const result = await window.dshDesktop.wizard.submit({
      apiKey: apiKey.value.trim(),
      workspace: workspace.value,
    })
    if (!result.ok) {
      showError(result.error || '提交失败')
      submit.disabled = false
      submit.textContent = '开始使用'
    }
    // 成功：主进程关闭本窗口
  } catch (err) {
    showError(String(err))
    submit.disabled = false
    submit.textContent = '开始使用'
  }
})

window.dshDesktop.wizard.onError((msg) => {
  showError(msg)
  submit.disabled = false
  submit.textContent = '开始使用'
})
