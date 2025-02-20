const { app, BrowserWindow } = require('electron')
const path = require('path')
const { PythonShell } = require('python-shell')

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  })

  win.loadFile('index.html')
}

// Python脚本调用示例
function runPythonScript() {
  let options = {
    mode: 'text',
    pythonPath: 'python3',
    pythonOptions: ['-u'], // 不缓冲输出
    scriptPath: __dirname,
    args: ['参数1', '参数2']
  }

  PythonShell.run('script.py', options).then(messages => {
    console.log('Python输出:', messages)
  })
}

app.whenReady().then(() => {
  createWindow()
}) 