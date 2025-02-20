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

const writeLog = (message) => {
  const logPath = path.join(app.isPackaged ? process.resourcesPath : __dirname, 'debug.txt')
  const timestamp = new Date().toISOString()
  const logMessage = `${timestamp}: ${message}\n`
  fs.appendFileSync(logPath, logMessage)
}

// 获取Python路径
function getPythonPath() {
  if (app.isPackaged) {
    const pythonPath = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'python',
      'venv',
      process.platform === 'win32' ? 'Scripts' : 'bin',
      process.platform === 'win32' ? 'python.exe' : 'python'
    )
    
    writeLog(`Checking Python path: ${pythonPath}`)
    writeLog(`Process resources path: ${process.resourcesPath}`)
    writeLog(`Path exists: ${fs.existsSync(pythonPath)}`)

    if (!fs.existsSync(pythonPath)) {
      writeLog(`Error: Python not found at ${pythonPath}`)
      throw new Error(`Python not found at ${pythonPath}`)
    }
    return pythonPath
  } else {
    const pythonPath = path.join(
      'python',
      'venv',
      process.platform === 'win32' ? 'Scripts' : 'bin',
      process.platform === 'win32' ? 'python.exe' : 'python'
    )
    writeLog(`Development Python path: ${pythonPath}`)
    return pythonPath
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
    const getScriptPath = () => {
      const scriptPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'python', 'script.py')
        : path.join(__dirname, '..', 'python', 'script.py')

      writeLog(`Checking script path: ${scriptPath}`)
      writeLog(`Script exists: ${fs.existsSync(scriptPath)}`)
      
      if (!fs.existsSync(scriptPath)) {
        writeLog(`Error: Script not found at ${scriptPath}`)
        throw new Error(`Script not found at ${scriptPath}`)
      }
      return scriptPath
    }

    let options = {
      mode: 'text',
      pythonPath: getPythonPath(),
      pythonOptions: ['-u'],
      scriptPath: path.dirname(getScriptPath()),
      args: [audioPath],
      env: {
        ...process.env,
        MODEL_ROOT: path.join(os.homedir(), '.milochy', 'models')
      }
    }

    writeLog(`Python options: ${JSON.stringify(options, null, 2)}`)

    let allResults = [];
    const pyshell = new PythonShell('script.py', options);

    pyshell.on('message', async function (message) {
      writeLog(`Python message: ${message}`)
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
        writeLog(`Transcription error: ${err}`)
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