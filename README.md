# 今晚吃啥

一个可添加到 iOS 主屏幕的晚餐小转盘。食物、主题和最近结果都只保存在当前浏览器。

## 本地运行

在这个目录中启动任意静态文件服务器，例如：

```powershell
python -m http.server 4173
```

然后打开 `http://localhost:4173/`。

## 添加到 iPhone 主屏幕

1. 将整个目录部署到支持 HTTPS 的静态网站服务。
2. 在 iPhone 的 Safari 中打开网址。
3. 点 Safari 底部的分享按钮。
4. 选择「添加到主屏幕」。

安装后可以离线打开。若只是在局域网中用 `http://` 临时访问，页面本身能使用，但 Service Worker 离线缓存通常需要 HTTPS 或 `localhost`。

## 字体

主标题使用 Smiley Sans（得意黑），按 SIL Open Font License 1.1 随页面一同分发。许可文本位于 `assets/fonts/OFL.txt`。
