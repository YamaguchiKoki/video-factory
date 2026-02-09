---
name: remotion-social-media-generator
description: Remotion for dynamic social media video generation. Use when building video compositions with API data, creating social templates, rendering programmatic videos, or animating content for Instagram/TikTok/Twitter. Covers compositions, animations, data fetching, and programmatic rendering.
---

# Remotion Social Media Generator

Dynamic video generation with Remotion for social media platforms using API data.

## When to Apply

- Building social media video templates with dynamic content
- Rendering videos programmatically from API data
- Creating platform-specific aspect ratios (1:1, 9:16, 16:9)
- Animating text, graphics, or data visualizations

## Critical Rules

**Dynamic Props**: Use `getInputProps()` for runtime data, `calculateMetadata()` for API fetching

```tsx
// WRONG - Static content only
const MyVideo = () => <h1>Fixed Title</h1>;

// RIGHT - Dynamic from props/API
const MyVideo = () => {
  const {title, subtitle} = getInputProps() as VideoProps;
  return <h1>{title}</h1>;
};
```

**Platform Dimensions**: Set correct aspect ratios per platform

```tsx
// Instagram/Twitter: 1080x1080 (1:1)
<Composition width={1080} height={1080} />

// TikTok/Reels: 1080x1920 (9:16)  
<Composition width={1080} height={1920} />

// YouTube: 1920x1080 (16:9)
<Composition width={1920} height={1080} />
```

**Frame-Based Animations**: Always use `useCurrentFrame()` and `spring()`, never CSS animations

```tsx
// WRONG - CSS animations don't work
<div className="animate-bounce">Text</div>

// RIGHT - Frame-based animation
const frame = useCurrentFrame();
const {fps} = useVideoConfig();
const scale = spring({frame, fps});
<div style={{transform: `scale(${scale})`}}>Text</div>
```

## Key Patterns

### API-Driven Composition

```tsx
interface VideoProps {
  title: string;
  metrics: {views: number; likes: number};
  brandColor: string;
}

export const Root = () => (
  <Composition
    id="social-post"
    component={SocialVideo}
    width={1080}
    height={1080}
    fps={30}
    durationInFrames={150}
    calculateMetadata={async ({props}) => {
      const data = await fetch(`/api/post/${props.id}`);
      const json = await data.json();
      return {props: {...props, ...json}};
    }}
  />
);
```

### Staggered Text Animations

```tsx
const TextReveal: React.FC<{lines: string[]}> = ({lines}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  
  return (
    <>
      {lines.map((text, i) => {
        const delay = i * 0.3 * fps;
        const opacity = interpolate(
          frame - delay,
          [0, 0.5 * fps],
          [0, 1],
          {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}
        );
        
        return (
          <div key={i} style={{opacity, fontSize: 48}}>
            {text}
          </div>
        );
      })}
    </>
  );
};
```

### Timeline Sequencing

```tsx
const SocialTemplate = () => {
  const {fps} = useVideoConfig();
  
  return (
    <AbsoluteFill>
      {/* Logo intro: frames 0-30 */}
      <Sequence durationInFrames={30}>
        <LogoAnimation />
      </Sequence>
      
      {/* Main content: frames 20-120 (overlap) */}
      <Sequence from={20} durationInFrames={100}>
        <MainContent />
      </Sequence>
      
      {/* CTA: frames 100 to end */}
      <Sequence from={100}>
        <CallToAction />
      </Sequence>
    </AbsoluteFill>
  );
};
```

### Programmatic Rendering

```tsx
// render-batch.ts
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';

const generateVideos = async (posts: PostData[]) => {
  const bundleLocation = await bundle({
    entryPoint: './src/index.ts',
  });

  for (const post of posts) {
    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: 'social-post',
      inputProps: post,
    });

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: 'h264',
      outputLocation: `./out/${post.id}.mp4`,
      inputProps: post,
      crf: 18, // High quality for social
    });
  }
};
```

## Common Mistakes

- **Missing extrapolate props**: Always use `{extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}` in `interpolate()`
- **Inconsistent inputProps**: Pass same props to both `selectComposition()` and `renderMedia()`
- **Wrong frame calculations**: Use `fps` from `useVideoConfig()` for time-based delays
- **Static dimensions**: Don't hardcode video dimensions - use platform-specific sizes