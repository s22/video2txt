from faster_whisper import WhisperModel

def transcribe_audio(audio_path):
    model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, info = model.transcribe(audio_path)
    
    results = []
    for segment in segments:
        results.append({
            'text': segment.text,
            'start': segment.start,
            'end': segment.end
        })
    
    return results

if __name__ == "__main__":
    import sys
    import json
    
    # 获取命令行参数
    audio_path = sys.argv[1] if len(sys.argv) > 1 else "test.mp3"
    
    # 运行转录
    results = transcribe_audio(audio_path)
    
    # 输出JSON格式结果
    print(json.dumps(results)) 