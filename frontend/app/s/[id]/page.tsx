"use client";

import clsx from "clsx";
import { Download } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/logo";
import { Button, Spinner } from "@/components/ui";
import { api, formatDuration, media, SharedVideo } from "@/lib/api";

/** A shared version, watchable by anyone with the link; no account needed. */
export default function SharedVideoPage() {
  const { id } = useParams<{ id: string }>();
  const [video, setVideo] = useState<SharedVideo | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.shared(id).then((v) => {
      setVideo(v);
      document.title = `${v.title} · Braque`;
    }).catch(() => setMissing(true));
  }, [id]);

  const portrait = video?.aspect === "9:16" || video?.aspect === "4:5";

  return (
    <main className="studio-glow flex min-h-dvh flex-col bg-bg">
      <header className="flex h-16 items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="Braque">
          <Wordmark />
        </Link>
        {video && (
          <a href={media.sharedVideo(id, true)}>
            <Button size="sm" icon={<Download className="size-3.5" strokeWidth={1.75} />}>Download</Button>
          </a>
        )}
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
        {missing ? (
          <div className="text-center">
            <p className="text-[18px] font-semibold tracking-[-0.01em]">This link isn&apos;t available</p>
            <p className="mt-1.5 text-[14px] text-muted">It may have been turned off by the person who shared it.</p>
          </div>
        ) : !video ? (
          <Spinner className="text-faint" />
        ) : (
          <figure className={clsx("fade-up w-full", portrait ? "max-w-[420px]" : "max-w-[1040px]")}>
            <div className="overflow-hidden rounded-card bg-film shadow-e4">
              <video src={media.sharedVideo(id)} controls autoPlay playsInline className="block max-h-[78vh] w-full bg-film" />
            </div>
            <figcaption className="mt-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-1">
              <div>
                <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">{video.title}</h1>
                <p className="mt-1 text-[13.5px] text-muted">
                  By {video.studio || "a Braque studio"}
                  {video.duration ? ` · ${formatDuration(video.duration)}` : ""} · {video.aspect}
                </p>
              </div>
              <Link href="/" className="text-[13px] text-faint underline-offset-4 hover:text-muted hover:underline">
                Made with Braque
              </Link>
            </figcaption>
          </figure>
        )}
      </div>
    </main>
  );
}
