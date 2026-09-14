from bisect import bisect_left
from dataclasses import dataclass

CHUNK_SIZE = 2000
OVERLAP = 200
STEP = CHUNK_SIZE - OVERLAP


@dataclass(frozen=True)
class Chunk:
    content: str
    start: int
    end: int
    start_line: int
    end_line: int


def chunk_text(text: str) -> list[Chunk]:
    newlines = [offset for offset, char in enumerate(text) if char == "\n"]

    def line_at(offset: int) -> int:
        return bisect_left(newlines, offset) + 1

    chunks: list[Chunk] = []

    for start in range(0, len(text), STEP):
        end = min(start + CHUNK_SIZE, len(text))
        chunks.append(
            Chunk(
                content=text[start:end],
                start=start,
                end=end,
                start_line=line_at(start),
                end_line=line_at(end - 1),
            )
        )

        if end == len(text):
            break

    return chunks
