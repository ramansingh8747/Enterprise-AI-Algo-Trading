import os
import uuid
from pathlib import Path
from typing import BinaryIO

from fastapi import UploadFile

from app.core.config.settings import settings
from app.services.strategy_import.parser import StrategyFileParser


class StrategyImportService:
    ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".xlsx"}
    MAX_FILE_SIZE = 10 * 1024 * 1024

    def __init__(self) -> None:
        self.parser = StrategyFileParser()

    def validate(self, filename: str, content_length: int) -> str:
        extension = Path(filename).suffix.lower()
        if extension not in self.ALLOWED_EXTENSIONS:
            raise ValueError("Unsupported file type. Upload PDF, DOCX, TXT or XLSX.")
        if content_length <= 0:
            raise ValueError("Uploaded strategy file is empty.")
        if content_length > self.MAX_FILE_SIZE:
            raise ValueError("Strategy file exceeds the 10 MB upload limit.")
        return extension

    async def save_and_parse_upload(self, file: UploadFile, filename: str):
        extension = self.validate(filename, 1)
        storage_dir = Path(settings.STRATEGY_UPLOAD_DIR)
        storage_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f"{uuid.uuid4().hex}{extension}"
        target = storage_dir / stored_name
        size = 0
        try:
            with target.open("wb") as output:
                while True:
                    chunk = await file.read(1024 * 1024)
                    if not chunk:
                        break
                    size += len(chunk)
                    if size > self.MAX_FILE_SIZE:
                        raise ValueError("Strategy file exceeds the 10 MB upload limit.")
                    output.write(chunk)
            if size == 0:
                raise ValueError("Uploaded strategy file is empty.")
            text, config, warnings = self.parser.parse(target, extension)
            return stored_name, extension.lstrip("."), size, text, config, warnings
        except Exception:
            target.unlink(missing_ok=True)
            raise

    def save_and_parse(self, file: BinaryIO, filename: str, content_length: int):
        extension = self.validate(filename, content_length)
        storage_dir = Path(settings.STRATEGY_UPLOAD_DIR)
        storage_dir.mkdir(parents=True, exist_ok=True)
        stored_name = f"{uuid.uuid4().hex}{extension}"
        target = storage_dir / stored_name
        with target.open("wb") as output:
            while True:
                chunk = file.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
        try:
            text, config, warnings = self.parser.parse(target, extension)
        except Exception:
            target.unlink(missing_ok=True)
            raise
        return stored_name, extension.lstrip("."), target.stat().st_size, text, config, warnings
