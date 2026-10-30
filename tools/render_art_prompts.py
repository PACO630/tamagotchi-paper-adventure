#!/usr/bin/env python3
"""Render the official hand-drawn skill style #5 (MS Paint 烂涂鸦) prompt for every character
and enemy using the skill's own scripts/render_prompt.py, and write docs/art-prompts.md.

The game draws its sprites procedurally from these same rules (src/art/paint.ts); the prompts are
kept so the exact recipe can be reused with an image model if desired.
Usage: python3 -B tools/render_art_prompts.py
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / ".claude" / "skills" / "hand-drawn"
OUT = ROOT / "docs" / "art-prompts.md"

SUBJECTS = [
    ("麻美吉 Mametchi（主角）", "麻美吉（Mametchi）：奶油黃色圓滾滾身體、頭頂兩隻深藍色尖耳朵、黑豆眼、粉紅臉頰的拓麻歌子小怪物，全身正面站立"),
    ("美美吉 Memetchi", "美美吉（Memetchi）：粉紅色長捲髮、頭頂紅色蝴蝶結、桃色臉蛋的拓麻歌子女孩，全身正面站立"),
    ("庫奇帕奇 Kuchipatchi", "庫奇帕奇（Kuchipatchi）：嫩綠色圓滾滾身體、大大的橘色嘴唇、頭頂一撮小毛的拓麻歌子，全身正面站立"),
    ("咪咪吉 Mimitchi", "咪咪吉（Mimitchi）：淡藍色身體、兩隻長長的兔子耳朵（粉紅內耳）的拓麻歌子，全身正面站立"),
    ("紫羅蘭吉 Violetchi", "紫羅蘭吉（Violetchi）：紫色身體、貓咪尖耳朵、白色口鼻、耳朵上黃色蝴蝶結的拓麻歌子，全身正面站立"),
    ("忍者吉 Gozarutchi", "忍者吉（Gozarutchi）：深藍色忍者頭巾包住全身、露出臉、額頭綁紅色頭帶的拓麻歌子，全身正面站立"),
    ("假面吉 Maskutchi", "假面吉（Maskutchi）：白色身體、黑色眼罩面具、紅色披風、頭頂小星星的拓麻歌子英雄，全身正面站立"),
    ("老爺爺吉 Oyajitchi", "老爺爺吉（Oyajitchi）：淺青色身體、大大的白鬍子、圓眼鏡、頭頂三根毛的拓麻歌子老爺爺，全身正面站立"),
    ("Boss：混亂的守護者", "一座被黑暗力量附身的灰色石像守護者，紅色發光眼睛"),
    ("Boss：糖果森林暴走樹王", "一棵失控的巨大粉紅色糖果樹怪物，樹幹上有生氣的臉"),
    ("Boss：暴風雲龍", "一條淺藍色的雲朵龍，黃色角，在暴風中飛翔"),
    ("Boss：失控的超級機器人", "一個紅色方塊身體的巨大玩具機器人，螢幕臉發出紅光"),
    ("Boss：深海古代守護者", "一條藍色金鱗的古代巨魚"),
    ("Boss：失憶的城堡騎士", "一位藍紫色盔甲、拿長槍、頭盔有羽飾的騎士"),
    ("Boss：黑暗麻美吉", "黑色版本的麻美吉，紅色發光眼睛，看起來很不安"),
    ("最終 Boss：星之守護者 永恆吉", "一顆戴著王冠、淡黃色、周圍有紫色光點的巨大星星守護者，表情悲傷"),
]


def render(subject: str) -> str:
    cmd = [sys.executable, "-B", "scripts/render_prompt.py", "--style", "5", "--var", f"主体={subject}"]
    res = subprocess.run(cmd, cwd=SKILL, capture_output=True, text=True, check=True)
    return res.stdout.strip()


def main() -> None:
    lines = [
        "# 角色美術提示詞（hand-drawn skill 第 5 號：MS Paint 烂涂鸦）",
        "",
        "由 `.claude/skills/hand-drawn/scripts/render_prompt.py --style 5` 產生，未經改寫。",
        "遊戲內的角色是依照同一份配方程序化繪製（`src/art/paint.ts`、`src/art/characterArt.ts`、`src/art/enemyArt.ts`）：",
        "抖動且斷續的線條、比例刻意不對、涂出邊界的大塊純色、像素鋸齒、白色背景（作為紙片外框）、沒有漸層與精修。",
        "",
    ]
    for title, subject in SUBJECTS:
        lines += [f"## {title}", "", "```", render(subject), "```", ""]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
