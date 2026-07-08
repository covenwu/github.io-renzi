"""从 jieba 开源词典生成离线二字词表（按词频降序取前 N 个）。

用法: python tools/make_wordlist.py <jieba_dict.txt> [N=20000]
输出: vendor/words2.txt（每行一个二字词，按词频降序，UTF-8）

词典来源: https://github.com/fxsjy/jieba (MIT License)
"""
import sys


def is_cjk(ch):
    o = ord(ch)
    return 0x3400 <= o <= 0x4DBF or 0x4E00 <= o <= 0x9FFF or 0x20000 <= o <= 0x2FA1F


def main(dict_path, n):
    entries = []
    with open(dict_path, encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if len(parts) < 2:
                continue
            word, freq = parts[0], int(parts[1])
            if len(word) == 2 and all(is_cjk(c) for c in word):
                entries.append((freq, word))
    entries.sort(reverse=True)
    words = [w for _, w in entries[:n]]
    with open("vendor/words2.txt", "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(words) + "\n")
    print(f"生成 vendor/words2.txt: {len(words)} 个二字词")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 20000)
