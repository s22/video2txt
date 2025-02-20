from faster_whisper import WhisperModel
import os

print("当前工作目录:", os.getcwd())
print("\n正在初始化模型（这将触发下载）...")

try:
    model = WhisperModel("base", device="cpu", compute_type="int8")
    print("\n模型加载成功！")
except Exception as e:
    print(f"\n加载模型时出错: {e}") 