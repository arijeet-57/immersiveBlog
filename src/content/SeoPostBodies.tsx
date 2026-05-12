import { posts } from './posts';

// Renders every post body into the DOM so crawlers can index post content
// regardless of whether the user is currently on its slug route. Hidden via
// visibility: hidden + pointer-events: none (per BLUEPRINT §4.5) rather
// than display: none, so the content is present in the tree.
export default function SeoPostBodies() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        overflow: 'hidden',
        visibility: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {posts.map((p) => {
        const Body = p.Component;
        return (
          <article key={p.slug} data-slug={p.slug}>
            <h1>{p.title}</h1>
            <div>
              <time dateTime={p.date}>{p.date}</time>
              <span> · {p.author}</span>
            </div>
            <Body />
          </article>
        );
      })}
    </div>
  );
}
