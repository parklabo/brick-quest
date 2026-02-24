# Google Gemini API Reference for Brick Quest

> Last updated: 2026-02-24
> SDK: `@google/genai` (JavaScript/TypeScript)
> Docs: https://ai.google.dev/gemini-api/docs

---

## Table of Contents

- [Available Models](#available-models)
- [Brick Quest Current Usage](#brick-quest-current-usage)
- [Model Comparison Matrix](#model-comparison-matrix)
- [Pricing](#pricing)
- [Rate Limits](#rate-limits)
- [API Usage Guide](#api-usage-guide)
  - [Text Generation (Structured JSON)](#text-generation-structured-json)
  - [Image Generation](#image-generation)
  - [Image Editing](#image-editing)
  - [Thinking Config](#thinking-config)
  - [Multi-turn Chat](#multi-turn-chat)
- [Image Generation Deep Dive](#image-generation-deep-dive)
- [Model Deep Dive — What Each Model Excels At](#model-deep-dive--what-each-model-excels-at)
- [Benchmark Comparison](#benchmark-comparison)
- [Migration Notes (2.5 → 3.x)](#migration-notes-25--3x)
- [Recommendations for Brick Quest](#recommendations-for-brick-quest)

---

## Available Models

### Gemini 3 Series (Latest — Preview)

| Model ID                     | Type           | Context (Input/Output) | Key Features                                                     |
| ---------------------------- | -------------- | ---------------------- | ---------------------------------------------------------------- |
| `gemini-3.1-pro-preview`     | Text/Reasoning | 1M / 64K               | Latest reasoning model, agentic workflows, vibe coding           |
| `gemini-3-pro-preview`       | Text/Reasoning | 1M / 64K               | State-of-the-art reasoning, multimodal understanding             |
| `gemini-3-flash-preview`     | Text/Reasoning | 1M / 64K               | Frontier-class perf at low cost, fast                            |
| `gemini-3-pro-image-preview` | Image Gen      | 65K / 32K              | 4K image gen, text rendering, search grounding (Nano Banana Pro) |

### Gemini 2.5 Series (Stable / GA)

| Model ID                 | Type           | Context (Input/Output) | Key Features                           |
| ------------------------ | -------------- | ---------------------- | -------------------------------------- |
| `gemini-2.5-pro`         | Text/Reasoning | 1M / 64K               | Complex tasks, deep reasoning, coding  |
| `gemini-2.5-flash`       | Text/Reasoning | 1M / 64K               | Best price-performance, low-latency    |
| `gemini-2.5-flash-lite`  | Text/Reasoning | 1M / 64K               | Fastest, cheapest, high-throughput     |
| `gemini-2.5-flash-image` | Image Gen      | —                      | Native image gen/editing (Nano Banana) |

### Specialized Models

| Model ID                                        | Type       | Purpose                           |
| ----------------------------------------------- | ---------- | --------------------------------- |
| `imagen` (Imagen 4)                             | Image Gen  | Text-to-image up to 2K resolution |
| `veo-3.1-generate-preview`                      | Video Gen  | Cinematic video generation        |
| `gemini-embedding-001`                          | Embeddings | Semantic search vectors           |
| `gemini-2.5-flash-preview-tts`                  | TTS        | Text-to-speech                    |
| `gemini-2.5-flash-native-audio-preview-12-2025` | Audio      | Real-time conversational agents   |

### Deprecation Notice

> Gemini 2.0 Flash and Gemini 2.0 Flash-Lite will be **retired on March 31, 2026**.

---

## Brick Quest Current Usage

**`packages/functions/src/config.ts`** 설정:

| Role              | Config Key           | Model ID                     | Purpose                       |
| ----------------- | -------------------- | ---------------------------- | ----------------------------- |
| Primary Reasoning | `model`              | `gemini-3.1-pro-preview`     | Complex tasks (build, design) |
| Fast Text         | `fastModel`          | `gemini-3-flash-preview`     | Simple tasks (scan)           |
| Text Fallback     | `fallbackModel`      | `gemini-3-flash-preview`     | Text fallback on 503/429      |
| Primary Image     | `imageModel`         | `gemini-3-pro-image-preview` | Composite view generation     |
| Image Fallback    | `fallbackImageModel` | `gemini-2.5-flash-image`     | Image fallback on 503/429     |

### Usage by Function

| Function                              | Primary                    | Fallback                               | Thinking |       Retry        | Modality           |
| ------------------------------------- | -------------------------- | -------------------------------------- | :------: | :----------------: | ------------------ |
| `analyzeLegoParts()` (scan)           | `fastModel` (3 Flash)      | `model` (3.1 Pro)                      |    2K    |    2 x 2 models    | Image+Text → JSON  |
| `generateBuildPlan()` (build)         | `model` (3.1 Pro)          | `fallbackModel` (3 Flash)              |  8K–32K  | 3 parse x 3 agent  | Text → JSON        |
| `generateOrthographicViews()` (views) | `imageModel` (3 Pro Image) | `fallbackImageModel` (2.5 Flash Image) |    —     | 2 pro + 1 fallback | Image+Text → Image |
| `generateDesignFromPhoto()` (design)  | `model` (3.1 Pro)          | `fallbackModel` (3 Flash)              |  8K–32K  | 3 parse x 3 agent  | Image+Text → JSON  |
| `generateLegoPreview()` (preview)     | `imageModel` (3 Pro Image) | `fallbackImageModel` (2.5 Flash Image) |    —     |     Sequential     | Image+Text → Image |

### Model Selection Rationale

| Task                           | Why This Model                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| **Scan** → 3 Flash             | Part recognition is simple visual task. 3x faster, 75% cheaper than Pro. Pro-level accuracy. |
| **Build** → 3.1 Pro            | Needs best spatial reasoning (ARC-AGI-2: 77.1%) for 3D brick placement.                      |
| **Design Build** → 3.1 Pro     | Same complex 3D reasoning as Build, plus reference image analysis.                           |
| **Design Views** → 3 Pro Image | Only model with 4K resolution + thinking for consistent multi-view generation.               |
| **Fallback** → 3 Flash         | Pro-level quality (SWE-Bench: 78%) at Flash speed when primary is unavailable.               |

---

## Model Comparison Matrix

### Text/Reasoning Models

| Feature             | 3.1 Pro Preview  |  3 Pro Preview   | 3 Flash Preview  |     2.5 Pro      |    2.5 Flash     | 2.5 Flash-Lite |
| ------------------- | :--------------: | :--------------: | :--------------: | :--------------: | :--------------: | :------------: |
| Context Window      |        1M        |        1M        |        1M        |        1M        |        1M        |       1M       |
| Max Output          |       64K        |       64K        |       64K        |       64K        |       64K        |      64K       |
| Thinking            | `thinking_level` | `thinking_level` | `thinking_level` | `thinkingBudget` | `thinkingBudget` |       —        |
| Structured Output   |       JSON       |       JSON       |       JSON       |       JSON       |       JSON       |      JSON      |
| Function Calling    |       Yes        |       Yes        |       Yes        |       Yes        |       Yes        |      Yes       |
| Code Execution      |       Yes        |       Yes        |       Yes        |       Yes        |       Yes        |      Yes       |
| Search Grounding    |       Yes        |       Yes        |       Yes        |       Yes        |       Yes        |      Yes       |
| Image Understanding |       Yes        |       Yes        |       Yes        |       Yes        |       Yes        |      Yes       |
| Video Understanding |       Yes        |       Yes        |       Yes        |       Yes        |       Yes        |      Yes       |
| Audio Understanding |       Yes        |       Yes        |       Yes        |       Yes        |       Yes        |      Yes       |
| Context Caching     |       Yes        |       Yes        |       Yes        |       Yes        |       Yes        |      Yes       |
| Batch API           |       Yes        |       Yes        |       Yes        |       Yes        |       Yes        |      Yes       |
| Knowledge Cutoff    |     Jan 2025     |     Jan 2025     |     Jan 2025     |     Jan 2025     |     Jan 2025     |    Jan 2025    |

### Image Generation Models

| Feature           | 3 Pro Image Preview | 2.5 Flash Image |
| ----------------- | :-----------------: | :-------------: |
| Text-to-Image     |         Yes         |       Yes       |
| Image Editing     |         Yes         |       Yes       |
| Multi-turn Chat   |         Yes         |       Yes       |
| Max Resolution    |         4K          |       1K        |
| Text Rendering    | Advanced (legible)  |      Basic      |
| Search Grounding  |         Yes         |       No        |
| Thinking Mode     |         Yes         |       No        |
| Reference Images  |      Up to 14       |     Limited     |
| Aspect Ratios     |     10 options      |   10 options    |
| Structured Output |         Yes         |       No        |
| Context (Input)   |         65K         |        —        |
| Context (Output)  |         32K         |        —        |

---

## Pricing

### Text Models (per 1M tokens)

| Model                      | Input (≤200K) | Input (>200K) |    Output     | Batch Input | Batch Output |
| -------------------------- | :-----------: | :-----------: | :-----------: | :---------: | :----------: |
| **gemini-3.1-pro-preview** |     $2.00     |     $4.00     | $12.00–$18.00 | $1.00–$2.00 | $6.00–$9.00  |
| **gemini-3-pro-preview**   |     $2.00     |     $4.00     | $12.00–$18.00 | $1.00–$2.00 | $6.00–$9.00  |
| **gemini-3-flash-preview** |     $0.50     |     $1.00     |     $3.00     |    $0.25    |    $1.50     |
| **gemini-2.5-pro**         |     $1.25     |     $2.50     | $10.00–$15.00 |   $0.625    | $5.00–$7.50  |
| **gemini-2.5-flash**       |     $0.30     |     $1.00     |     $2.50     |    $0.15    |    $1.25     |
| **gemini-2.5-flash-lite**  |     $0.10     |     $0.30     |     $0.40     |    $0.05    |    $0.20     |

### Image Models

| Model                          | Input (text/image) | Output (per image) | Notes                     |
| ------------------------------ | :----------------: | :----------------: | ------------------------- |
| **gemini-3-pro-image-preview** |  $2.00/1M tokens   |    $0.134–$0.24    | Resolution dependent      |
| **gemini-2.5-flash-image**     |      Standard      |       $0.039       | ~1290 output tokens/image |
| **Imagen 4**                   |         —          |    $0.02–$0.06     | Fast/Standard/Ultra tiers |

### Context Caching Discount

- Cached token input: ~75% discount vs standard pricing
- Storage: $4.50/1M tokens/hour (3 Pro), $1.00/1M tokens/hour (2.5 Flash)

### Batch Processing

- ~50% discount on all models vs standard pricing
- Turnaround: up to 24 hours

### Free Tier

| Model                  | Available | Notes                    |
| ---------------------- | :-------: | ------------------------ |
| gemini-3-flash-preview |   Free    | Input/output tokens free |
| gemini-2.5-flash-lite  |   Free    | Input/output tokens free |
| gemini-2.5-flash       |   Free    | Limited RPM/RPD          |
| gemini-2.5-pro         |   Free    | Very limited RPM/RPD     |

---

## Rate Limits

### Free Tier

| Model                  | RPM |   TPM   |  RPD  |
| ---------------------- | :-: | :-----: | :---: |
| gemini-3-pro-preview   | 10  | 250,000 |  100  |
| gemini-3-flash-preview | 10  | 250,000 |  250  |
| gemini-2.5-pro         |  5  | 250,000 |  100  |
| gemini-2.5-flash       | 10  | 250,000 |  250  |
| gemini-2.5-flash-lite  | 15  | 250,000 | 1,000 |

### Tier 1 (Paid)

| Model                 | RPM |    TPM    |  RPD  |
| --------------------- | :-: | :-------: | :---: |
| gemini-2.5-pro        | 150 | 1,000,000 | 1,000 |
| gemini-2.5-flash      | 300 | 2,000,000 | 1,500 |
| gemini-2.5-flash-lite | 300 | 2,000,000 | 1,500 |

### Tier 2

| Model                 |  RPM  |    TPM    |  RPD   |
| --------------------- | :---: | :-------: | :----: |
| gemini-2.5-pro        | 1,000 | 2,000,000 | 10,000 |
| gemini-2.5-flash      | 2,000 | 4,000,000 | 10,000 |
| gemini-2.5-flash-lite | 2,000 | 4,000,000 | 10,000 |

> Rate limits are per-project (not per API key). Daily quotas reset at midnight Pacific Time.
> Check live limits at: https://aistudio.google.com/rate-limit

---

## API Usage Guide

### SDK Setup

```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

### Text Generation (Structured JSON)

Brick Quest의 scan/build/design에서 사용하는 패턴:

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: {
    parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64Image } }, { text: 'Analyze this image and return structured data' }],
  },
  config: {
    responseMimeType: 'application/json',
    responseSchema: mySchema, // OpenAPI Schema object
    maxOutputTokens: 65536,
    thinkingConfig: { thinkingBudget: 16384 },
    systemInstruction: 'You are an expert LEGO builder.',
  },
});

const result = JSON.parse(response.text);
```

### Image Generation

Brick Quest의 `generateOrthographicViews()`에서 사용하는 패턴:

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-3-pro-image-preview',
  contents: {
    parts: [{ inlineData: { mimeType, data: base64Image } }, { text: 'Generate LEGO orthographic views...' }],
  },
  config: {
    responseModalities: ['IMAGE', 'TEXT'],
  },
});

// Extract image from response
for (const part of response.candidates[0].content.parts) {
  if (part.inlineData?.data) {
    const buffer = Buffer.from(part.inlineData.data, 'base64');
    // Save or process the image
  }
}
```

### Image Generation with Options (3 Pro Image)

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-3-pro-image-preview',
  contents: 'A LEGO Brickheadz model of a cat',
  config: {
    responseModalities: ['IMAGE', 'TEXT'],
    imageConfig: {
      aspectRatio: '1:1', // 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9
      imageSize: '2K', // 1K, 2K, 4K
    },
  },
});
```

### Image Editing

```typescript
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash-image',
  contents: [{ text: 'Add a red hat to this LEGO figure' }, { inlineData: { mimeType: 'image/png', data: base64Image } }],
  config: {
    responseModalities: ['IMAGE', 'TEXT'],
  },
});
```

### Thinking Config

#### Gemini 3.x (New — `thinking_level`)

```typescript
// Gemini 3.x uses thinking_level (string enum)
const response = await ai.models.generateContent({
  model: 'gemini-3-pro-preview',
  contents: 'Complex reasoning task...',
  config: {
    thinkingConfig: {
      thinkingLevel: 'high', // 'minimal' | 'low' | 'medium' | 'high'
    },
  },
});
```

| Level     | Description                       | Best For              |
| --------- | --------------------------------- | --------------------- |
| `minimal` | Minimal reasoning (Flash only)    | Simple tasks          |
| `low`     | Minimizes latency and cost        | Straightforward tasks |
| `medium`  | Balanced (3.1 Pro & Flash only)   | Moderate complexity   |
| `high`    | Maximum reasoning depth (default) | Complex tasks         |

#### Gemini 2.5 (Legacy — `thinkingBudget`)

```typescript
// Gemini 2.5 uses thinkingBudget (number — token count)
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: 'Complex reasoning task...',
  config: {
    thinkingConfig: {
      thinkingBudget: 16384,
      // includeThoughts: true,  // optional: return thinking tokens
    },
  },
});
```

> You cannot use both `thinking_level` and `thinkingBudget` in one request.

### Multi-turn Chat

```typescript
const chat = ai.chats.create({
  model: 'gemini-3-pro-image-preview',
  config: {
    responseModalities: ['TEXT', 'IMAGE'],
    imageConfig: { aspectRatio: '1:1', imageSize: '2K' },
  },
});

// Turn 1: Generate
const response1 = await chat.sendMessage({
  message: 'Create a LEGO Brickheadz cat',
});

// Turn 2: Edit
const response2 = await chat.sendMessage({
  message: 'Add sunglasses to it',
});
```

---

## Image Generation Deep Dive

### Nano Banana vs Nano Banana Pro

| Feature          | Nano Banana (`gemini-2.5-flash-image`) | Nano Banana Pro (`gemini-3-pro-image-preview`) |
| ---------------- | :------------------------------------: | :--------------------------------------------: |
| Speed            |                  Fast                  |                     Slower                     |
| Max Resolution   |                   1K                   |                       4K                       |
| Text Rendering   |                 Basic                  |          Advanced (legible, stylized)          |
| Thinking Mode    |                   No                   |                      Yes                       |
| Search Grounding |                   No                   |              Yes (real-time data)              |
| Reference Images |                Limited                 |         Up to 14 (6 objects, 5 humans)         |
| Cost per Image   |                 $0.039                 |                  $0.134–$0.24                  |
| Best For         |         High-volume, quick gen         |         Professional assets, precision         |

### Available Aspect Ratios

`1:1` `2:3` `3:2` `3:4` `4:3` `4:5` `5:4` `9:16` `16:9` `21:9`

### Resolution Options (3 Pro Image only)

`1K` `2K` `4K` (use uppercase K)

### Safety

- All generated images include **SynthID watermarks**
- Content moderation applies automatically
- Prohibited: deceptive content, impersonation, harmful content

---

## Model Deep Dive — What Each Model Excels At

### gemini-3.1-pro-preview

> Released: 2026-02-19 | Price: $2–$4 input, $12–$18 output per 1M tokens

**한 줄 요약**: 현존 최강 reasoning 모델. 3 Pro 대비 추론 2.5배, 코딩 20%+, agentic 45%+ 향상.

**핵심 강점**:

- **추상적 추론 (ARC-AGI-2)**: 77.1% — 3 Pro(31.1%)의 2.5배, 2.5 Pro(4.9%)의 15배
- **과학 지식 (GPQA Diamond)**: 94.3% — 최고 수준
- **경쟁 코딩 (LiveCodeBench Pro)**: Elo 2887 — GPT-5.2(2393), 3 Pro(2439) 대폭 초과
- **실전 코딩 (SWE-Bench Verified)**: 80.6% — Claude Opus 4.6(80.9%)과 0.3% 차이
- **Agentic 검색 (BrowseComp)**: 85.9% — 3 Pro(59.2%)에서 +26.7p
- **MCP 도구 활용 (MCP Atlas)**: 69.2% — 3 Pro(54.1%)에서 +15.1p
- **장문 컨텍스트 (MRCR v2 128K)**: 84.9% — 2.5 Pro(58%)보다 +26.9p

**Brick Quest 적합도**: ★★★★★

- Build plan 생성 시 복잡한 3D spatial reasoning에 최적
- Agent iteration loop에서 physics feedback 반영 능력 우수
- 15% 더 적은 토큰으로 동등한 품질 → 비용 효율성 향상
- `thinking_level: 'medium'` 지원 — 3 Pro에는 없는 중간 단계

**제한사항**:

- Preview 상태 (안정성 주의)
- `minimal` thinking level만 3.1 Pro와 Flash에서 지원
- 이미지 생성 불가 (text/reasoning 전용)
- Image segmentation 미지원

**vs 3 Pro Preview 주요 차이**:
| Metric | 3 Pro | 3.1 Pro | 향상 |
|--------|:---:|:---:|:---:|
| ARC-AGI-2 (추론) | 31.1% | 77.1% | +148% |
| SWE-Bench (코딩) | 76.8% | 80.6% | +3.8p |
| Terminal-Bench 2.0 | 56.9% | 68.5% | +20.4% |
| BrowseComp (검색) | 59.2% | 85.9% | +26.7p |
| MCP Atlas (도구) | 54.1% | 69.2% | +15.1p |
| Output 효율 | baseline | -15% tokens | 더 간결 |
| Thinking levels | low/high | minimal/low/medium/high | +2 단계 |

---

### gemini-3-pro-preview

> Released: 2025-11-18 | Price: $2–$4 input, $12–$18 output per 1M tokens

**한 줄 요약**: 3 시리즈 기본 Pro 모델. 2.5 Pro 대비 모든 벤치마크에서 대폭 향상.

**핵심 강점**:

- 2.5 Pro 대비 전반적으로 크게 향상된 reasoning
- Multimodal understanding (이미지/비디오/오디오 입력)
- Structured JSON output + thinking 조합 안정적
- 1M token context window

**Brick Quest 적합도**: ★★★★☆

- 현재 primary model로 사용 중
- Build plan 생성 품질 양호
- 3.1 Pro가 나온 이상 업그레이드 권장

**vs 3.1 Pro**: 동일 가격인데 3.1 Pro가 모든 면에서 우위 → **3.1 Pro로 교체 권장**

---

### gemini-3-flash-preview

> Released: 2025-12-17 | Price: $0.50 input, $3.00 output per 1M tokens | Free Tier 있음

**한 줄 요약**: Pro급 성능을 Flash 가격/속도로. 가성비 최강.

**핵심 강점**:

- **속도**: 평균 16.36s — 2.5 Flash(44.63s)의 3배 빠름
- **가성비**: 1,337 quality/$1K — 2.5 Flash(451)의 3배, 3 Pro(224)의 6배
- **PhD 추론 (GPQA Diamond)**: 90.4% — 2.5 Pro를 초과
- **실전 코딩 (SWE-Bench)**: 78% — 2.5 Flash와 3 Pro를 모두 초과
- **효율성**: 2.5 Pro 대비 30% 적은 토큰 사용
- **비전**: Code execution 통합으로 이미지 분석 시 자동 zoom/crop/annotation
- Free tier 사용 가능

**Brick Quest 적합도**: ★★★★☆

- Scan (부품 인식)에 최적 — 빠르고 정확하며 저렴
- Fallback model로 2.5 Flash 대신 사용하면 품질 대폭 향상
- 가격: 3 Pro의 1/4, 2.5 Flash 대비 약간 비싸지만 성능은 Pro급

**Best Use Cases**:

- 빠른 응답이 필요한 scan 작업
- Fallback model (503 에러 시)
- 비용 민감한 프로덕션 환경
- 고처리량 배치 작업

**약점**:

- 최고 난이도 reasoning에서는 3.1 Pro에 밀림 (quality 8.73/10 vs 9.03/10)
- Creative/verbose 출력에서 2.5 Flash에 약간 밀리는 경우 있음

---

### gemini-3-pro-image-preview (Nano Banana Pro)

> Released: 2025-11-18 | Price: $2/1M input tokens, $0.134–$0.24/image output

**한 줄 요약**: 최고 품질 이미지 생성. 4K, 텍스트 렌더링, 복잡한 프롬프트 이해.

**핵심 강점**:

- **4K 해상도**: 최대 4096x4096 지원
- **텍스트 렌더링**: 이미지 내 텍스트가 선명하고 읽기 쉬움
- **Thinking 모드**: 복잡한 프롬프트를 추론하며 처리
- **Search Grounding**: 실시간 데이터 기반 이미지 생성 (날씨, 뉴스 등)
- **Reference Images**: 최대 14장 (6 objects, 5 humans) 참조 가능
- **Multi-turn editing**: 대화형으로 이미지를 점진적 수정

**Brick Quest 적합도**: ★★★★★

- Composite orthographic views 생성에 현재 사용 중
- 4방향 LEGO 뷰의 일관성 유지에 중요한 reasoning 능력
- `imageConfig.imageSize: '2K'` 설정 추가로 뷰 품질 향상 가능

**vs 2.5 Flash Image**:
| | 3 Pro Image | 2.5 Flash Image |
|---|:---:|:---:|
| 속도 | 8–12초 | ~4초 |
| 품질 | 최고 | 양호 |
| 해상도 | 4K | 1K |
| 텍스트 렌더링 | 선명 | 기본 |
| 복잡한 프롬프트 | 우수 | 보통 |
| 가격/이미지 | $0.134–$0.24 | $0.039 |
| 적합 용도 | 프로덕션 품질 | 빠른 프로토타입 |

**제한사항**:

- Context window 작음 (65K input / 32K output)
- Function calling 미지원
- Code execution 미지원
- Caching 미지원

---

### gemini-2.5-flash

> Stable/GA | Price: $0.30 input, $2.50 output per 1M tokens

**한 줄 요약**: 안정적이고 검증된 Flash 모델. 가격 대비 성능 우수.

**핵심 강점**:

- **안정성**: GA (General Availability) — 프로덕션 검증 완료
- **가격**: 3 Flash보다 약간 저렴
- **생태계**: 가장 널리 사용, 문서/커뮤니티 풍부
- **Thinking**: `thinkingBudget`으로 세밀한 토큰 수 제어

**Brick Quest 적합도**: ★★★☆☆

- 현재 fallback model로 사용 중
- 안정성은 장점이지만 3 Flash 대비 성능과 속도 모두 열세
- 점진적으로 3 Flash로 교체 권장

---

### gemini-2.5-pro

> Stable/GA | Price: $1.25 input, $10.00 output per 1M tokens

**한 줄 요약**: 2.5 시리즈 최상위. 복잡한 작업에 안정적이지만 3.x에 밀림.

**핵심 강점**:

- **안정성**: GA — 프로덕션 검증 완료
- **비주얼 웹앱 코딩**: "visually compelling web apps" 생성에 강점
- **코드 변환**: 기존 코드베이스 변환/마이그레이션에 우수

**Brick Quest 적합도**: ★★☆☆☆

- 3 Pro/3.1 Pro 대비 모든 벤치마크에서 열세
- 가격은 3 Pro의 62% 수준이지만 성능 차이가 크다
- 새로 채택할 이유 없음

---

### gemini-2.5-flash-image (Nano Banana)

> Stable | Price: $0.039/image

**한 줄 요약**: 빠르고 저렴한 이미지 생성. 프로토타이핑에 최적.

**Brick Quest 적합도**: ★★★☆☆

- 현재 image fallback model로 사용 중
- 503 에러 시 빠르게 대체 가능
- 품질은 3 Pro Image에 확실히 열세하지만 "없는 것보다 나은" fallback

---

## Benchmark Comparison

### 주요 벤치마크 전체 비교

| Benchmark                | Category           |  3.1 Pro  | 3 Pro | 3 Flash | 2.5 Pro | 2.5 Flash |
| ------------------------ | ------------------ | :-------: | :---: | :-----: | :-----: | :-------: |
| **Humanity's Last Exam** | General            |   44.4%   |   —   |  33.7%  |  21.6%  |     —     |
| **ARC-AGI-2**            | Abstract Reasoning | **77.1%** | 31.1% |    —    |  4.9%   |     —     |
| **GPQA Diamond**         | Science/PhD        | **94.3%** |   —   |  90.4%  |  86.4%  |     —     |
| **MMMU Pro**             | Multimodal         | **80.5%** |   —   |  81.2%  |   68%   |     —     |
| **MMMLU**                | General Knowledge  | **92.6%** |   —   |    —    |    —    |     —     |
| **LiveCodeBench Pro**    | Competitive Coding | **2887**  | 2439  |    —    |  1775   |     —     |
| **SWE-Bench Verified**   | Real Coding        | **80.6%** | 76.8% |   78%   |  59.6%  |     —     |
| **Terminal-Bench 2.0**   | Terminal Coding    | **68.5%** | 56.9% |    —    |  32.6%  |     —     |
| **BrowseComp**           | Agentic Search     | **85.9%** | 59.2% |    —    |    —    |     —     |
| **MCP Atlas**            | Tool Use           | **69.2%** | 54.1% |    —    |    —    |     —     |
| **APEX-Agents**          | Long-horizon Agent | **33.5%** |   —   |    —    |    —    |     —     |
| **MRCR v2 (128K)**       | Long Context       | **84.9%** |   —   |    —    |   58%   |     —     |
| **MRCR v2 (1M)**         | Long Context       | **26.3%** |   —   |    —    |  16.4%  |     —     |

### 속도 비교 (실측 평균)

```
gemini-3-flash-preview    ████████ 16.4s        (가장 빠름)
gemini-3-pro-preview      ████████████████ 34.8s
gemini-2.5-flash          ████████████████████████ 44.6s
gemini-2.5-pro            ██████████████████████████ 51.2s
```

### 가성비 (Quality Points per $1,000)

```
gemini-3-flash-preview    ████████████████████████████████████ 1,337  (가장 효율적)
gemini-2.5-flash          ████████████ 451
gemini-3-pro-preview      ██████ 224
gemini-2.5-pro            ████ 163
```

### Brick Quest 용도별 최적 모델 추천

| Brick Quest 기능               | 최적 모델                    | 이유                         | 대안                   |
| ------------------------------ | ---------------------------- | ---------------------------- | ---------------------- |
| **Scan** (부품 인식)           | `gemini-3-flash-preview`     | 빠르고 정확, 비용 1/4        | 3.1 Pro (정확도 우선)  |
| **Build** (조립 계획)          | `gemini-3.1-pro-preview`     | 최고 reasoning, spatial 추론 | 3 Pro (안정성 우선)    |
| **Design Views** (뷰 생성)     | `gemini-3-pro-image-preview` | 4K, 일관성, thinking         | 2.5 Flash Image (속도) |
| **Design Build** (설계 → 조립) | `gemini-3.1-pro-preview`     | 복잡한 3D reasoning 최적     | 3 Flash (비용 우선)    |
| **Preview** (미리보기 이미지)  | `gemini-2.5-flash-image`     | 빠르고 저렴, 비핵심          | 3 Pro Image (품질)     |
| **Fallback** (503/429 대비)    | `gemini-3-flash-preview`     | Pro급 품질, Flash 가격       | 2.5 Flash (안정성)     |

---

## Migration Notes (2.5 → 3.x)

### Thinking Config

```diff
// Before (2.5)
- thinkingConfig: { thinkingBudget: 16384 }

// After (3.x)
+ thinkingConfig: { thinkingLevel: 'high' }
```

### Key Changes

1. **Thinking**: Use `thinking_level` enum instead of `thinkingBudget` number
2. **Temperature**: Keep at default 1.0 (avoid low values with 3.x)
3. **Media Resolution**: New `media_resolution` parameter for vision tasks
   - `media_resolution_high` for images (1120 tokens)
   - `media_resolution_medium` for PDFs (560 tokens)
   - `media_resolution_low` for video (70 tokens/frame)
4. **Thought Signatures**: 3.x returns encrypted thought signatures for maintaining reasoning context across API calls (important for function calling and image gen)
5. **Computer Use**: Now integrated into main models (no separate model needed)
6. **Image Segmentation**: Not supported in 3.x — use Gemini 2.5 Flash or Robotics-ER 1.5

### Brick Quest Migration Checklist

When upgrading from preview to stable 3.x:

- [ ] Update `thinkingConfig` from `thinkingBudget` → `thinkingLevel` in `geminiBuild.ts` and `geminiDesign.ts`
- [ ] Test `media_resolution_high` for reference image analysis (may improve build accuracy)
- [ ] Consider using `imageConfig.imageSize: '2K'` for composite views (currently not set)
- [ ] Evaluate `gemini-3-flash-preview` as a cheaper fallback instead of `gemini-2.5-flash`
- [ ] Handle thought signatures if implementing multi-turn agent conversations

---

## Recommendations for Brick Quest

### 1. Composite View Generation 개선

현재: `responseModalities: ['IMAGE', 'TEXT']` 만 설정

추가 가능:

```typescript
config: {
  responseModalities: ['IMAGE', 'TEXT'],
  imageConfig: {
    aspectRatio: '1:1',   // 2x2 grid에 적합
    imageSize: '2K',      // 더 선명한 뷰 (현재 기본값 1K)
  },
},
```

### 2. Fallback Strategy 개선

현재 fallback 체인: `gemini-3-pro-preview` → `gemini-2.5-flash`

고려할 만한 옵션:

```
gemini-3-pro-preview → gemini-3-flash-preview → gemini-2.5-flash
```

- `gemini-3-flash-preview`는 3 Pro보다 저렴하면서도 2.5 Flash보다 높은 품질
- Free tier에서도 사용 가능

### 3. 비용 최적화

| Optimization                       | Saving        | Effort |
| ---------------------------------- | ------------- | ------ |
| Batch API (비실시간 작업)          | ~50%          | Low    |
| Context Caching (반복 프롬프트)    | ~75%          | Medium |
| `gemini-3-flash-preview` for scans | ~75% vs 3 Pro | Low    |
| `media_resolution` 파라미터 활용   | Token 절감    | Low    |

### 4. 503 에러 대응 강화

현재 구현은 양호하나 추가로:

- Exponential backoff에 jitter 추가 (동시 요청 시 thundering herd 방지)
- 503 에러 빈도 모니터링 → 자동으로 fallback 모델 우선 사용

### 5. Thinking Level Migration (향후)

3.x 모델이 stable 되면:

```typescript
// 현재 (2.5 호환)
thinkingConfig: {
  thinkingBudget: cfg.thinking;
}

// 향후 (3.x)
thinkingConfig: {
  thinkingLevel: detail === 'detailed' ? 'high' : 'medium';
}
```

---

## Reference Links

### Official Docs

- [Gemini API Models](https://ai.google.dev/gemini-api/docs/models)
- [Gemini 3 Developer Guide](https://ai.google.dev/gemini-api/docs/gemini-3)
- [Image Generation (Nano Banana)](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini 3 Pro Image](https://ai.google.dev/gemini-api/docs/models/gemini-3-pro-image-preview)
- [Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [JS SDK (`@google/genai`)](https://github.com/googleapis/js-genai)
- [Release Notes](https://ai.google.dev/gemini-api/docs/changelog)

### Model Cards & Benchmarks

- [Gemini 3.1 Pro Model Card — Google DeepMind](https://deepmind.google/models/model-cards/gemini-3-1-pro/)
- [Gemini 3.1 Pro vs 3 Pro Comparison](https://help.apiyi.com/en/gemini-3-1-pro-vs-3-pro-preview-comparison-guide-en.html)
- [Gemini 2.5 Pro vs 3.1 Pro Comparison](https://docsbot.ai/models/compare/gemini-2-5-pro/gemini-3-1-pro)
- [Gemini 3 Flash vs 2.5 Flash/Pro Benchmark](https://ai-crucible.com/articles/gemini-3-flash-comparison/)
- [Gemini 3.1 Pro Blog Post — Google](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro/)
- [Rate Limits Per-Tier Guide](https://www.aifreeapi.com/en/posts/gemini-api-rate-limits-per-tier)
