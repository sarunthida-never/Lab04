---
name: review-pr
description: รีวิว pull request ตามหมายเลข อิงมาตรฐานของทีม
allowed-tools: Read, Grep, Glob, Bash(gh pr view:*), Bash(gh pr diff:*)
argument-hint: <pr-number>
---

รีวิว PR หมายเลข $1 ของ repo นี้

## ข้อมูล PR
!`gh pr view $1`

## Diff
!`gh pr diff $1`

## มาตรฐานทีม (source of truth)
@docs/review-checklist.md

สรุปเป็น: (1) บั๊ก/ความเสี่ยงเรียงตามความรุนแรง (2) สิ่งที่ควรแก้ก่อน merge (3) ข้อเสนอปรับปรุงไม่บังคับ
