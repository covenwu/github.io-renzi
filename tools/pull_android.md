# 从安卓手机拉取认字数据（一次性操作）

前提：电脑装有 adb；手机开启 USB 调试并连接。原应用是 debug 构建，
可用 `run-as` 直接读取应用私有目录。

## 1. 拉取数据库（PowerShell）

```powershell
mkdir android-data; cd android-data
adb exec-out run-as com.babyword.learnword cat databases/babyword.db > babyword.db
# WAL 日志若存在也要拉（报错 No such file 可忽略）：
adb exec-out run-as com.babyword.learnword cat databases/babyword.db-wal > babyword.db-wal
adb exec-out run-as com.babyword.learnword cat databases/babyword.db-shm > babyword.db-shm
```

## 2. 拉取提示照片

```powershell
mkdir photos
adb exec-out run-as com.babyword.learnword ls files > filelist.txt
Get-Content filelist.txt | Where-Object { $_ -match '\.jpg$' } | ForEach-Object {
  adb exec-out run-as com.babyword.learnword cat "files/$_" > "photos/$_"
}
```

注意：PowerShell 的 `>` 重定向默认可能损坏二进制流。若拉取的 db/照片损坏，
改用 CMD 执行相同命令（`cmd /c "adb exec-out ... > file"`），
adb exec-out 本身是二进制安全的。

## 3. 转换为 backup.zip

```powershell
python ..\tools\migrate_android.py babyword.db photos backup.zip
```

## 4. 传到 iPad 导入

把 backup.zip 通过微信/网盘/隔空投送传到 iPad，在认字应用
「字库 / 设置」页点「📥 导入」选择该文件。
