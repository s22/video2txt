from faster_whisper import WhisperModel
import os
from pathlib import Path
import json
import sys
from huggingface_hub import hf_hub_download

def get_model_path():
    # 获取用户目录下的模型文件夹
    home = os.path.expanduser("~")
    model_dir = os.path.join(home, ".milochy", "models", "medium")
    return str(model_dir)

def ensure_model_downloaded():
    model_path = get_model_path()
    model_dir = Path(model_path)
    
    # 如果目录不存在，创建它
    model_dir.mkdir(parents=True, exist_ok=True)
    
    # 需要下载的文件列表
    files = [
        "config.json",
        "model.bin",
        "tokenizer.json",
        "vocabulary.txt"
    ]
    
    print("正在检查模型文件...", flush=True)
    
    # 从 Hugging Face 下载模型文件
    for file in files:
        if not (model_dir / file).exists():
            print(f"下载 {file}...", flush=True)
            hf_hub_download(
                repo_id="guillaumekln/faster-whisper-medium",
                filename=file,
                local_dir=model_path
            )
    
    print("模型文件准备完成", flush=True)

def transcribe_audio(audio_path):
    model_path = get_model_path()
    
    # 确保模型文件存在
    ensure_model_downloaded()
    
    # 使用本地模型目录
    model = WhisperModel(
        model_path,
        device="cpu",
        compute_type="int8"
    )
    
    # 实时输出转录结果
    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500
        ),
        language="zh",
        initial_prompt="以下是普通话内容"
    )
    
    # 逐段输出结果
    for segment in segments:
        result = {
            'text': segment.text,
            'start': segment.start,
            'end': segment.end
        }
        # 使用特殊标记表示这是实时结果
        print(f"SEGMENT:{json.dumps(result)}", flush=True)
    
    # 输出完成标记
    print("DONE", flush=True)

if __name__ == "__main__":
    # 获取命令行参数
    audio_path = sys.argv[1] if len(sys.argv) > 1 else "test.mp3"
    
    # 运行转录
    transcribe_audio(audio_path) 