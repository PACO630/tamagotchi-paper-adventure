import './styles/main.css';
import { app } from './core/app';

app.boot().catch((e) => {
  console.error(e);
  const msg = document.getElementById('boot-msg');
  if (msg) msg.textContent = `啟動失敗：${(e as Error).message}`;
});
