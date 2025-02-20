const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { PythonShell } = require('python-shell')
const fs = require('fs')
const os = require('os')

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
  const getPackagedPath = () => {
    const basePath = path.join(process.resourcesPath, 'app.asar.unpacked', 'python', 'venv')
    if (process.platform === 'darwin') {
      return path.join(basePath, 'bin', 'python')
    } else {
      return path.join(basePath, 'Scripts', 'python.exe')
    }
  }

  const getDevPath = () => {
    const basePath = path.join(__dirname, '..', 'python', 'venv')
    if (process.platform === 'win32') {
      return path.join(basePath, 'Scripts', 'python.exe')
    } else {
      return path.join(basePath, 'bin', 'python')
    }
  }

  const pythonPath = app.isPackaged ? getPackagedPath() : getDevPath()
  return pythonPath.replace(/\\/g, '/') // 统一使用正斜杠
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
    const getScriptPath = () => {
      const basePath = app.isPackaged 
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'python')
        : path.join(__dirname, '..', 'python')
      return basePath.replace(/\\/g, '/')
    }

    let options = {
      mode: 'text',
      pythonPath: getPythonPath(),
      pythonOptions: ['-u'],
      scriptPath: getScriptPath(),
      args: [audioPath.replace(/\\/g, '/')], // 确保音频路径也使用正斜杠
      env: {
        ...process.env,
        MODEL_ROOT: path.join(os.homedir(), '.milochy', 'models').replace(/\\/g, '/')
      }
    }

    console.log('Python options:', JSON.stringify(options, null, 2)) // 添加调试日志

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