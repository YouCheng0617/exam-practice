import type { Subject } from "../types";
import kana from "./kana";
import { kanaDakuon, kanaYouon } from "./kana-branch";

// ============================================================
// 內建、所有人都看得到的題庫。使用者自己的題庫是上傳或從分享連結匯入，只存在自己的瀏覽器。
// 要新增公開題庫：在這個資料夾加一個檔案（格式見 data/types.ts 的 Subject），再加進下面的陣列。
// ============================================================
export const SUBJECTS: Subject[] = [kana, kanaDakuon, kanaYouon];
