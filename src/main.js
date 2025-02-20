const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { PythonShell } = require('python-shell')
const fs = require('fs')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    title: 'Milochy视频文案提取',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    menuBarVisible: false
  })

  mainWindow.setMenu(null)

  mainWindow.loadFile(path.join(__dirname, 'index.html'))
}

// 获取Python路径
function getPythonPath() {
  if (app.isPackaged) {
    // 根据平台选择正确的 Python 路径
    if (process.platform === 'darwin') {  // macOS
      return path.join(process.resourcesPath, 'python', 'venv', 'bin', 'python')
    } else {  // Windows
      return path.join(process.resourcesPath, 'python', 'venv', 'Scripts', 'python.exe')
    }
  } else {
    // 开发环境使用系统 Python
    if (process.platform === 'win32') {
      return 'python/venv/Scripts/python.exe'
    } else {
      return 'python/venv/bin/python'
    }
  }
}

// 保存文本文件
async function saveTranscription(audioPath, segments) {
  // 创建与音频文件同名的txt文件
  const txtPath = audioPath.replace(/\.[^/.]+$/, '.txt')
  
  // 提取纯文本
  const text = segments.map(segment => segment.text).join('\n')
  
  // 写入文件
  await fs.promises.writeFile(txtPath, text, 'utf8')
  
  return txtPath
}

// 处理音频转录
ipcMain.handle('transcribe-audio', async (event, audioPath) => {
  return new Promise((resolve, reject) => {
    let options = {
      mode: 'text',
      pythonPath: getPythonPath(),
      pythonOptions: ['-u'],
      scriptPath: app.isPackaged 
        ? path.join(process.resourcesPath, 'python')
        : path.join(__dirname, '..', 'python'),
      args: [audioPath],
      env: {
        ...process.env,
        MODEL_ROOT: app.isPackaged 
          ? path.join(process.resourcesPath, 'models')
          : path.join(__dirname, '..', 'models')
      }
    }

    let allResults = [];
    const pyshell = new PythonShell('script.py', options);

    pyshell.on('message', async function (message) {
      if (message.startsWith('SEGMENT:')) {
        const segmentData = JSON.parse(message.slice(8));
        allResults.push(segmentData);
        mainWindow.webContents.send('transcription-progress', segmentData);
      } else if (message === 'DONE') {
        try {
          // 保存文本文件
          const txtPath = await saveTranscription(audioPath, allResults)
          resolve({ results: allResults, txtPath })
        } catch (error) {
          reject(error)
        }
      }
    });

    pyshell.end(function (err) {
      if (err) {
        console.error('Transcription error:', err);
        reject(err);
      }
    });
  });
});

// 处理打开文件请求
ipcMain.handle('open-file', async (event, filePath) => {
  await shell.showItemInFolder(filePath)
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
}) 