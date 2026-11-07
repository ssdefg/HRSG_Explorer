"""HRSG_RAG_참고문헌_목록.xlsx(APA 서지 · 파일명) → rag/bibliography.json  {doc_id: {title, doi, citation, file}}

AI 어시스턴트의 근거 카드에 논문 제목·DOI를 표시하기 위한 서지 메타데이터만 만든다 (원문 텍스트 없음).
표준 라이브러리만 쓴다 (openpyxl 불필요).

사용법:  python scripts/build_bibliography.py     (scripts/build_corpus.py 로 rag/doc_map.json 을 만든 뒤)
"""

import html
import json
import re
import unicodedata
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
XLSX_NAME = "HRSG_RAG_참고문헌_목록.xlsx"
DOC_MAP = ROOT / "rag" / "doc_map.json"
OUT = ROOT / "rag" / "bibliography.json"

# 코퍼스 쪽 파일명이 목록과 다른 경우 (build_corpus.py EXCLUDE 의 중복 파일 — MD5 동일)
FILE_ALIASES = {"admin,+ARO_11098_20230221_V2.pdf": "ARO2023_Koya.pdf"}

DOI_RE = re.compile(r"10\.\d{4,9}/[^\s]+")
TITLE_RE = re.compile(r"\(\d{4}[a-z]?(?:, [^)]*)?\)\.\s*(.+?)[.?!]\s")


def read_rows(path: Path) -> list[dict[str, str]]:
    """첫 시트의 행을 {열 문자: 값} 으로 읽는다 (공유 문자열 · 인라인 문자열 · 숫자)."""
    z = zipfile.ZipFile(path)
    strings = []
    if "xl/sharedStrings.xml" in z.namelist():
        ss = z.read("xl/sharedStrings.xml").decode("utf-8")
        strings = [html.unescape(re.sub(r"<[^>]+>", "", s)) for s in re.findall(r"<si>(.*?)</si>", ss, re.S)]
    sheet = z.read("xl/worksheets/sheet1.xml").decode("utf-8")
    rows = []
    for row in re.findall(r"<row[^>]*>(.*?)</row>", sheet, re.S):
        cells = {}
        for col, attrs, body in re.findall(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)', row, re.S):
            v = re.search(r"<v>(.*?)</v>", body or "", re.S)
            t = re.search(r"<t[^>]*>(.*?)</t>", body or "", re.S)
            if 't="s"' in attrs and v:
                cells[col] = strings[int(v.group(1))]
            elif t:
                cells[col] = html.unescape(t.group(1))
            elif v:
                cells[col] = v.group(1)
        rows.append(cells)
    return rows


def parse_apa(citation: str) -> dict[str, str | None]:
    doi = DOI_RE.search(citation)
    title = TITLE_RE.search(citation + " ")
    return {
        "title": title.group(1).strip() if title else None,
        "doi": doi.group(0).rstrip(".,;") if doi else None,
        "citation": citation.strip(),
    }


def find_xlsx() -> Path:
    """macOS 에서 받은 파일은 한글 파일명이 NFD 로 저장돼 있을 수 있어 정규화해서 찾는다."""
    want = unicodedata.normalize("NFC", XLSX_NAME)
    for p in ROOT.glob("*.xlsx"):
        if unicodedata.normalize("NFC", p.name) == want:
            return p
    raise SystemExit(f"{XLSX_NAME} 를 프로젝트 루트에서 찾을 수 없습니다.")


def main() -> None:
    by_file = {}
    for cells in read_rows(find_xlsx())[1:]:  # 1행은 머리글 (No · APA · 파일명)
        file, apa = cells.get("C", "").strip(), cells.get("B", "").strip()
        if file and apa:
            by_file[file] = apa
    doc_map = json.loads(DOC_MAP.read_text(encoding="utf-8"))
    out, missing = {}, []
    for doc_id, info in doc_map.items():
        apa = by_file.get(info["file"]) or by_file.get(FILE_ALIASES.get(info["file"], ""))
        if not apa:
            missing.append(f"{doc_id} {info['file']}")
            continue
        out[doc_id] = {**parse_apa(apa), "file": info["file"]}
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(out)}/{len(doc_map)} docs · DOI {sum(1 for v in out.values() if v['doi'])} · title {sum(1 for v in out.values() if v['title'])}")
    for m in missing:
        print("  서지 없음:", m)


if __name__ == "__main__":
    main()
