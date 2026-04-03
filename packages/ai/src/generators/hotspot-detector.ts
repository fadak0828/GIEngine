import type { HotspotArea } from '@gi-engine/core';
import { geminiClient } from '../client.js';
import { calcSmartHotspotPositions } from '../interview/blueprint-converter.js';

export interface DetectedHotspot {
  hotspotId: string;
  area: HotspotArea;
  confidence: number;
}

export interface HotspotDetectionInput {
  hotspotId: string;
  label: string;
  actionType: string;
  contentHint?: string;
}

export interface DetectHotspotsOptions {
  imageBase64: string;
  hotspots: HotspotDetectionInput[];
  sceneWidth: number;
  sceneHeight: number;
}

function parseBoundingBoxes(
  responseText: string,
  hotspotIds: string[],
): Map<string, { x: number; y: number; width: number; height: number }> {
  const result = new Map<string, { x: number; y: number; width: number; height: number }>();

  for (const id of hotspotIds) {
    const patterns = [
      new RegExp(`${id}[^\\n]*?(\\d+)[^\\d]+(\\d+)[^\\d]+(\\d+)[^\\d]+(\\d+)`, 'i'),
      new RegExp(`${id}[^\\n]*?x[:\\s=]+(\\d+)[^\\n]*?y[:\\s=]+(\\d+)[^\\n]*?w[:\\s=]+(\\d+)[^\\n]*?h[:\\s=]+(\\d+)`, 'i'),
      new RegExp(`"${id}"[^\\n]*?"bbox"[^\\n]*?\\[(\\d+),\\s*(\\d+),\\s*(\\d+),\\s*(\\d+)\\]`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = responseText.match(pattern);
      if (match) {
        const [, x, y, width, height] = match.map(Number);
        if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
          result.set(id, { x, y, width, height });
          break;
        }
      }
    }
  }

  return result;
}

function normalizedToPixel(
  normalized: { x: number; y: number; width: number; height: number },
  sceneWidth: number,
  sceneHeight: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: Math.round(normalized.x * sceneWidth),
    y: Math.round(normalized.y * sceneHeight),
    width: Math.round(normalized.width * sceneWidth),
    height: Math.round(normalized.height * sceneHeight),
  };
}

export async function detectHotspotsFromImage(
  options: DetectHotspotsOptions,
): Promise<DetectedHotspot[]> {
  const { imageBase64, hotspots, sceneWidth, sceneHeight } = options;

  if (hotspots.length === 0) {
    return [];
  }

  const hotspotDescriptions = hotspots
    .map((h, i) => `${i + 1}. ${h.label} (${h.actionType})${h.contentHint ? `: ${h.contentHint}` : ''}`)
    .join('\n');

  const prompt = `You are an AI vision system for a mystery/deduction game.
Analyze the provided background image and identify the bounding boxes for each interactive object described below.

IMPORTANT RULES:
1. Return ONLY a JSON object with a "detections" array - no other text
2. Each detection must include: hotspotId, bbox [x, y, width, height] in NORMALIZED coordinates (0-1 relative to image dimensions)
3. bbox represents: x=top-left X, y=top-left Y, width=box width, height=box height
4. All objects MUST be detected - do not skip any
5. Boxes must NOT overlap
6. Return normalized values (0-1 range), not pixel values

Objects to detect:
${hotspotDescriptions}

Respond with ONLY this JSON format:
{
  "detections": [
    {"hotspotId": "hotspot_id_1", "bbox": [x, y, width, height], "confidence": 0.9},
    {"hotspotId": "hotspot_id_2", "bbox": [x, y, width, height], "confidence": 0.85}
  ]
}`;

  try {
    const responseText = await geminiClient.analyzeImage(imageBase64, prompt);
    const bboxMap = parseBoundingBoxes(responseText, hotspots.map(h => h.hotspotId));

    const detected: DetectedHotspot[] = [];
    let allDetected = true;

    for (const hotspot of hotspots) {
      const bbox = bboxMap.get(hotspot.hotspotId);
      if (bbox) {
        const pixelBbox = normalizedToPixel(bbox, sceneWidth, sceneHeight);
        detected.push({
          hotspotId: hotspot.hotspotId,
          area: { type: 'rect', ...pixelBbox },
          confidence: 0.8,
        });
      } else {
        allDetected = false;
      }
    }

    if (allDetected && detected.length === hotspots.length) {
      return detected;
    }

    return fallbackToSmartPositions(hotspots, sceneWidth, sceneHeight);
  } catch (error) {
    console.warn('Vision-based hotspot detection failed, using fallback:', error);
    return fallbackToSmartPositions(hotspots, sceneWidth, sceneHeight);
  }
}

function fallbackToSmartPositions(
  hotspots: HotspotDetectionInput[],
  sceneWidth: number,
  sceneHeight: number,
): DetectedHotspot[] {
  const hotspotActions = hotspots.map(h => ({
    action: { type: h.actionType },
  }));

  const positions = calcSmartHotspotPositions(hotspotActions, sceneWidth, sceneHeight);

  return hotspots.map((hotspot, i) => ({
    hotspotId: hotspot.hotspotId,
    area: { type: 'rect', ...positions[i] } as HotspotArea,
    confidence: 0.5,
  }));
}
