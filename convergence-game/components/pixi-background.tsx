"use client";

import { useEffect, useRef } from "react";
import { Application, BlurFilter, Container, Graphics } from "pixi.js";

export function PixiBackground() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let disposed = false;
    let app: Application | null = null;

    const setup = async () => {
      if (!hostRef.current) {
        return;
      }

      app = new Application();
      await app.init({
        resizeTo: hostRef.current,
        backgroundAlpha: 0,
        antialias: true,
      });

      if (disposed || !hostRef.current) {
        await app.destroy(true);
        return;
      }

      hostRef.current.appendChild(app.canvas);

      const world = new Container();
      const glow = new Graphics();
      const particles = new Container();
      const links = new Graphics();
      world.addChild(glow, links, particles);
      app.stage.addChild(world);

      const points = Array.from({ length: 28 }, (_, index) => ({
        x: ((index * 37) % 100) / 100,
        y: ((index * 23) % 100) / 100,
        radius: 1 + (index % 4),
        speed: 0.0006 + (index % 5) * 0.00012,
        offset: index * 0.17,
      }));

      glow.filters = [new BlurFilter({ strength: 22 })];

      app.ticker.add((ticker) => {
        const width = app?.screen.width ?? 0;
        const height = app?.screen.height ?? 0;
        const time = ticker.lastTime * 0.001;

        glow.clear()
          .rect(0, 0, width, height)
          .fill({ color: 0x11203d, alpha: 0.08 })
          .circle(width * 0.26, height * 0.28, width * 0.12)
          .fill({ color: 0x2b65ff, alpha: 0.08 })
          .circle(width * 0.74, height * 0.22, width * 0.1)
          .fill({ color: 0x30d6e7, alpha: 0.06 })
          .circle(width * 0.52, height * 0.8, width * 0.15)
          .fill({ color: 0xffb357, alpha: 0.05 });

        links.clear();
        particles.removeChildren();

        points.forEach((point, index) => {
          const x = point.x * width + Math.sin(time * point.speed * 1600 + point.offset) * 36;
          const y = point.y * height + Math.cos(time * point.speed * 1700 + point.offset) * 28;

          if (index < points.length - 1) {
            const nextPoint = points[index + 1];
            const nextX =
              nextPoint.x * width +
              Math.sin(time * nextPoint.speed * 1600 + nextPoint.offset) * 36;
            const nextY =
              nextPoint.y * height +
              Math.cos(time * nextPoint.speed * 1700 + nextPoint.offset) * 28;
            links
              .moveTo(x, y)
              .lineTo(nextX, nextY)
              .stroke({ color: 0x5fa8ff, width: 1, alpha: 0.08 });
          }

          const dot = new Graphics()
            .circle(x, y, point.radius)
            .fill({
              color: index % 3 === 0 ? 0x56a3ff : index % 3 === 1 ? 0x2dd4bf : 0xffb357,
              alpha: 0.55,
            });
          particles.addChild(dot);
        });
      });
    };

    void setup();

    return () => {
      disposed = true;
      if (app) {
        void app.destroy(true);
      }
    };
  }, []);

  return <div ref={hostRef} className="pointer-events-none absolute inset-0 overflow-hidden" />;
}
