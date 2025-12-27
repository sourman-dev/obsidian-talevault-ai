# Talemate Prompt Architecture - Essence Guide

> Tài liệu này tóm tắt kiến trúc xử lý prompt của Talemate để tham khảo cho các dự án LLM roleplay khác. Không có code, chỉ có khái niệm.

## 1. Kiến Trúc Đa Agent (Multi-Agent System)

Talemate không dùng một prompt duy nhất mà chia nhỏ thành **9 agent chuyên biệt**, mỗi agent có nhiệm vụ riêng:

| Agent | Nhiệm Vụ |
|-------|----------|
| **Narrator** | Viết nội dung câu chuyện, mô tả cảnh, hành động |
| **Conversation** | Tạo đối thoại cho NPC với tính cách riêng biệt |
| **Director** | Đề xuất hướng phát triển cốt truyện, chỉ đạo cảnh |
| **Editor** | Chỉnh sửa, cải thiện văn bản đã có |
| **Memory** | Quản lý ngân hàng ký ức, trích xuất thông tin quan trọng |
| **World State** | Theo dõi trạng thái thế giới (vị trí, thời gian, mối quan hệ) |
| **Summarizer** | Tóm tắt nội dung, nén context dài |
| **Creator** | Tạo nhân vật mới, bối cảnh, vật phẩm |
| **Visual/TTS** | Sinh prompt cho hình ảnh và giọng nói |

### Tại sao dùng Multi-Agent?

1. **Prompt chuyên biệt hơn**: Mỗi agent có system prompt riêng, tối ưu cho task cụ thể
2. **Kiểm soát output**: Dễ dàng điều chỉnh temperature, max_tokens cho từng loại task
3. **Context hiệu quả**: Chỉ đưa context cần thiết cho từng agent, không lãng phí token
4. **Mở rộng dễ dàng**: Thêm agent mới mà không ảnh hưởng agent khác

---

## 2. Cấu Trúc Prompt Template

### 2.1 Prompt UID (Unique Identifier)

Mỗi prompt có định danh theo format: `{agent_type}-{prompt_name}`

Ví dụ:
- `narrator-narrate` - Narrator viết nội dung
- `conversation-dialogue` - Tạo đối thoại
- `director-suggest` - Đề xuất hướng đi

### 2.2 Template Kế Thừa (Template Inheritance)

```
base-template.jinja2
    └── system-no-decensor.jinja2 (quy tắc chung)
        ├── narrator/system.jinja2
        ├── conversation/system.jinja2
        ├── director/system.jinja2
        └── editor/system.jinja2
```

**Nguyên tắc:**
- Template con include template cha
- Có thể override block cụ thể
- Tái sử dụng phần chung (system instructions, safety guidelines)

### 2.3 Thành Phần Một Prompt

Một prompt hoàn chỉnh gồm các phần:

```
┌─────────────────────────────────────────┐
│ SYSTEM PROMPT (Agent Identity)          │
│ - Vai trò của agent                     │
│ - Quy tắc viết                          │
│ - Hướng dẫn format output               │
├─────────────────────────────────────────┤
│ SCENE CONTEXT                           │
│ - Mô tả bối cảnh hiện tại               │
│ - Thông tin thế giới                    │
├─────────────────────────────────────────┤
│ CHARACTER CONTEXT                       │
│ - Thông tin nhân vật liên quan          │
│ - Tính cách, lịch sử, mối quan hệ       │
├─────────────────────────────────────────┤
│ MEMORY CONTEXT                          │
│ - Ký ức liên quan được truy xuất        │
│ - Thông tin từ các session trước        │
├─────────────────────────────────────────┤
│ HISTORY (Recent Messages)               │
│ - N tin nhắn gần nhất                   │
│ - Đối thoại/hành động vừa xảy ra        │
├─────────────────────────────────────────┤
│ USER INPUT / TASK                       │
│ - Input hiện tại cần xử lý              │
│ - Hướng dẫn cụ thể cho task này         │
├─────────────────────────────────────────┤
│ COERCION (Response Starter)             │
│ - Phần mở đầu response                  │
│ - Hướng LLM theo format mong muốn       │
└─────────────────────────────────────────┘
```

---

## 3. Context Management

### 3.1 Token Budget System

Talemate quản lý context qua **token budget** - số token tối đa cho mỗi phần:

| Thành phần | Ưu tiên | Budget % |
|------------|---------|----------|
| System Prompt | Cao nhất | Cố định |
| User Input | Cao | Cố định |
| Character Info | Trung bình | 15-25% |
| Recent History | Trung bình | 20-30% |
| Memories | Thấp | 10-20% |
| Scene Context | Thấp | Còn lại |

### 3.2 Context Compression Strategies

Khi context vượt budget:

1. **Summarization**: Tóm tắt lịch sử cũ
2. **Truncation**: Cắt bớt phần ít quan trọng
3. **Selective Retrieval**: Chỉ lấy memory/context liên quan
4. **Chunking**: Chia nhỏ task lớn

### 3.3 Memory Retrieval

Memory không đưa hết vào prompt mà **truy xuất có chọn lọc**:

1. **Relevance Scoring**: Tính điểm liên quan với input hiện tại
2. **Recency Weighting**: Ưu tiên ký ức gần đây
3. **Character Association**: Lấy ký ức liên quan đến nhân vật đang nói
4. **Topic Clustering**: Nhóm ký ức theo chủ đề

---

## 4. Inference Parameters (Presets)

### 4.1 Preset Categories

Mỗi loại task dùng preset khác nhau:

| Preset | Temperature | Use Case |
|--------|-------------|----------|
| **Creative** | 0.8-1.0 | Narration, dialogue sáng tạo |
| **Conversation** | 0.7-0.9 | Đối thoại tự nhiên |
| **Analytical** | 0.3-0.5 | Phân tích, trích xuất thông tin |
| **Deterministic** | 0.1-0.3 | Edit, fix lỗi, format |
| **Summarization** | 0.4-0.6 | Tóm tắt content |

### 4.2 Max Tokens Strategy

Max tokens động theo task:

- **Conversation**: 75-150 tokens (ngắn gọn, tự nhiên)
- **Narration**: 300-500 tokens (đủ chi tiết)
- **Summary**: 512-1024 tokens (tùy độ dài nguồn)
- **Analysis**: 500-2048 tokens (tùy độ phức tạp)

---

## 5. Data Flow

### 5.1 Request Flow

```
User Input
    │
    ▼
┌──────────────────┐
│ Agent Selection  │ ← Chọn agent phù hợp với task
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Context Assembly │ ← Thu thập context cần thiết
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Template Render  │ ← Render Jinja2 template
│ (First Pass)     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Second Pass      │ ← Xử lý dynamic content
│ Processing       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ LLM Call         │ ← Gửi prompt đến LLM
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Response Parse   │ ← Parse và validate output
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Post-Processing  │ ← Format, store, update state
└──────────────────┘
```

### 5.2 State Management

Trạng thái được track qua nhiều layer:

1. **Scene State**: Vị trí, thời gian, bối cảnh vật lý
2. **Character State**: Vị trí, trạng thái, mối quan hệ của từng nhân vật
3. **Conversation State**: Lịch sử đối thoại, context hiện tại
4. **World State**: Biến toàn cục, events, conditions

---

## 6. Special Techniques

### 6.1 Coercion (Response Steering)

**Coercion** là kỹ thuật "khởi động" response:

- Đặt phần mở đầu response sẵn
- Hướng LLM theo format/style mong muốn
- Giảm hallucination, tăng consistency

Ví dụ: Thay vì để LLM tự bắt đầu, đặt sẵn `"Character name:"` để đảm bảo format.

### 6.2 Two-Pass Rendering

Template được render 2 lần:

1. **First Pass**: Render static content, variables
2. **Second Pass**: Render dynamic content (agent state, computed values)

Giúp xử lý content phức tạp phụ thuộc vào kết quả first pass.

### 6.3 Agent Chaining

Một task phức tạp có thể chain nhiều agent:

```
User: "Make the story more dramatic"

Director (analyze) → suggestions
    │
    ▼
Editor (apply) → edited content
    │
    ▼
Narrator (expand) → final output
```

---

## 7. Key Principles

### 7.1 Separation of Concerns
- Mỗi agent một nhiệm vụ
- Template tách biệt khỏi logic
- Config tách biệt khỏi code

### 7.2 Context Efficiency
- Chỉ đưa context cần thiết
- Compress thông tin cũ
- Retrieve có chọn lọc

### 7.3 Output Consistency
- Preset theo task type
- Coercion để guide format
- Validation sau response

### 7.4 Extensibility
- Thêm agent mới dễ dàng
- Override template không ảnh hưởng core
- Config-driven behavior

---

## 8. So Sánh với Single-Prompt Approach

| Aspect | Single-Prompt | Multi-Agent (Talemate) |
|--------|---------------|------------------------|
| **Complexity** | Đơn giản | Phức tạp hơn |
| **Context Efficiency** | Thấp (đưa hết) | Cao (selective) |
| **Specialization** | Một prompt làm mọi thứ | Mỗi agent chuyên một việc |
| **Maintainability** | Dễ với project nhỏ | Tốt hơn khi scale |
| **Output Quality** | Phụ thuộc prompt design | Consistent hơn |
| **Token Usage** | Có thể lãng phí | Tối ưu hơn |

### 8.1 Khi Nào Dùng Multi-Agent?

**Nên dùng khi:**
- Có nhiều loại task khác nhau (narration, dialogue, analysis)
- Context lớn cần quản lý
- Cần output format khác nhau cho từng task
- Scale lên nhiều tính năng

**Single-prompt đủ khi:**
- Chỉ cần chat roleplay đơn giản
- Context nhỏ (< 4K tokens)
- Một loại output duy nhất
- Prototype/MVP

---

## 9. Áp Dụng Cho Project Khác

### 9.1 Minimum Viable Multi-Agent

Nếu muốn thử multi-agent với project hiện tại:

1. **Tách ít nhất 2 agent**: Chat vs Analysis
2. **Dùng system prompt khác nhau** cho mỗi agent
3. **Adjust temperature** theo task type
4. **Implement memory retrieval** thay vì đưa hết

### 9.2 Progressive Enhancement

Từ single-prompt → multi-agent:

```
Phase 1: Thêm preset system (temperature, max_tokens)
Phase 2: Tách summarization thành agent riêng
Phase 3: Implement memory retrieval
Phase 4: Thêm agent cho analysis/editing
```

---

## Kết Luận

Talemate's architecture xây dựng trên nguyên tắc:
- **Phân chia nhiệm vụ** cho các agent chuyên biệt
- **Quản lý context thông minh** qua token budgeting
- **Template system linh hoạt** cho prompt composition
- **Preset inference parameters** theo task type

Những concept này có thể áp dụng từng phần vào project LLM roleplay khác, bắt đầu từ đơn giản (preset system) đến phức tạp (full multi-agent).
