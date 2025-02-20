from pathlib import Path
import os

def find_model_paths():
    # 检查所有可能的缓存目录
    possible_paths = [
        Path.home() / '.cache' / 'huggingface' / 'hub',  # Linux/Mac
        Path.home() / 'Library' / 'Caches' / 'huggingface' / 'hub',  # Mac
        Path.home() / '.cache' / 'huggingface',  # 另一个可能的位置
        Path(os.getenv('APPDATA', '')) / 'huggingface' / 'hub'  # Windows
    ]

    print("正在搜索模型文件...")
    for path in possible_paths:
        if path.exists():
            print(f"\n找到缓存目录: {path}")
            # 递归搜索包含 model.bin 的目录
            for model_file in path.rglob('model.bin'):
                print(f"找到模型文件: {model_file}")
                print(f"模型目录: {model_file.parent}")
        else:
            print(f"\n目录不存在: {path}")

if __name__ == "__main__":
    find_model_paths() 