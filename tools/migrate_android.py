"""安卓版认字(com.babyword.learnword) Room 数据库 → PWA backup.zip

用法: python migrate_android.py <babyword.db> <photos_dir> <out.zip>

字段映射（安卓 → PWA）:
  character_table: character→char, photo_path→photos/<id>.jpg(按文件名匹配),
    learned_at→learnedAt, next_review_at→nextReviewAt, interval→interval,
    repetitions→repetitions, ease_factor→easeFactor, total_forgotten→totalWrong
  review_log: character_id→charId, reviewed_at→reviewedAt, remembered(0/1)→bool
"""
import json
import os
import shutil
import sqlite3
import sys
import tempfile
import time
import zipfile

BACKUP_VERSION = 1


def main(db_path, photos_dir, out_path):
    # 在临时副本上打开数据库：既让 SQLite 正常恢复 WAL，又不改动拉取下来的原始文件
    with tempfile.TemporaryDirectory() as tmp:
        work_db = os.path.join(tmp, "work.db")
        shutil.copy2(db_path, work_db)
        for ext in ("-wal", "-shm"):
            if os.path.isfile(db_path + ext):
                shutil.copy2(db_path + ext, work_db + ext)
        conn = sqlite3.connect(work_db)
        conn.row_factory = sqlite3.Row

        characters = []
        photo_files = {}  # zip内路径 -> 本地路径
        seen = {}  # 照片文件名 -> 原始 photo_path，用于检测同名冲突
        for r in conn.execute("SELECT * FROM character_table"):
            photo_ref = None
            basename = os.path.basename(r["photo_path"]) if r["photo_path"] else ""
            local = os.path.join(photos_dir, basename) if basename else ""
            if basename:
                prev = seen.get(basename)
                if prev is not None and prev != r["photo_path"]:
                    print(f"警告: 照片文件名冲突 {basename}，"
                          f"字「{r['character']}」的照片可能不正确，请导入后人工核对")
                seen[basename] = r["photo_path"]
            if basename and os.path.isfile(local):
                photo_ref = f"photos/{r['id']}.jpg"
                photo_files[photo_ref] = local
            characters.append({
                "id": r["id"],
                "char": r["character"],
                "photo": photo_ref,
                "learnedAt": r["learned_at"],
                "interval": r["interval"],
                "repetitions": r["repetitions"],
                "easeFactor": r["ease_factor"],
                "nextReviewAt": r["next_review_at"],
                "totalWrong": r["total_forgotten"],
            })

        review_log = [{
            "id": r["id"],
            "charId": r["character_id"],
            "reviewedAt": r["reviewed_at"],
            "remembered": bool(r["remembered"]),
        } for r in conn.execute("SELECT * FROM review_log")]
        conn.close()

        meta = {
            "version": BACKUP_VERSION,
            "exportedAt": int(time.time() * 1000),
            "characters": characters,
            "reviewLog": review_log,
        }
        with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("data.json", json.dumps(meta, ensure_ascii=False))
            for zip_path, local in photo_files.items():
                z.write(local, zip_path)

        print(f"完成: {len(characters)} 个字, {len(review_log)} 条复习记录, "
              f"{len(photo_files)} 张照片 -> {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2], sys.argv[3])
