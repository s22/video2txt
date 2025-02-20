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
    // 在打包环境中，Python 应该在 resources 目录下
    const basePath = path.join(process.resourcesPath, 'app.asar.unpacked', 'python', 'venv')
    const pythonPath = process.platform === 'win32'
      ? path.join(basePath, 'Scripts', 'python.exe')
      : path.join(basePath, 'bin', 'python')
    
    // 检查文件是否存在并输出详细信息
    console.log('Checking Python path:', pythonPath)
    console.log('Process resources path:', process.resourcesPath)
    console.log('Base path:', basePath)
    console.log('Path exists:', fs.existsSync(pythonPath))
    
    try {
      // 尝试获取目录内容
      if (fs.existsSync(basePath)) {
        console.log('Directory contents:', fs.readdirSync(basePath))
        if (process.platform === 'win32' && fs.existsSync(path.join(basePath, 'Scripts'))) {
          console.log('Scripts directory contents:', fs.readdirSync(path.join(basePath, 'Scripts')))
        }
      }
    } catch (err) {
      console.error('Error reading directory:', err)
    }

    if (!fs.existsSync(pythonPath)) {
      console.error('Python path not found:', pythonPath)
      throw new Error(`Python not found at ${pythonPath}`)
    }

    // 确保返回的路径不包含特殊字符
    return pythonPath.split('(')[0].trim()  // 移除括号及其后面的内容
  }

  const getDevPath = () => {
    const basePath = path.join(__dirname, '..', 'python', 'venv')
    const pythonPath = process.platform === 'win32'
      ? path.join(basePath, 'Scripts', 'python.exe')
      : path.join(basePath, 'bin', 'python')
    return pythonPath
  }

  // 获取并规范化路径，确保没有特殊字符
  const pythonPath = (app.isPackaged ? getPackagedPath() : getDevPath())
    .replace(/\\/g, '/')
    .replace(/\.\.\./g, '')  // 移除省略号
    .replace(/\([^)]*\)/g, '')  // 移除括号及其内容

  console.log('Final Python path:', pythonPath)
  return pythonPath
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
      
      // 检查脚本是否存在
      if (!fs.existsSync(scriptPath)) {
        console.error('Script not found:', scriptPath)
        throw new Error(`Script not found at ${scriptPath}`)
      }
      return scriptPath.replace(/\\/g, '/')
    }

    let options = {
      mode: 'text',
      pythonPath: getPythonPath(),
      pythonOptions: ['-u'],
      scriptPath: path.dirname(getScriptPath()),
      args: [audioPath.replace(/\\/g, '/')],
      env: {
        ...process.env,
        MODEL_ROOT: path.join(os.homedir(), '.milochy', 'models').replace(/\\/g, '/')
      }
    }

    console.log('Python options:', JSON.stringify(options, null, 2))

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