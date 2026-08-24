import React from 'react';
import { Badge, Button, Card, CardBody, CardFooter, CardHeader, Input } from '../components/ui';
import './DesignSystem.css';

/* --------------------------------------------------------------------------
   /design — the IRIS showcase.
   One page to judge the whole identity: tokens, type, primitives, elevation.
   Flip the theme toggle in the navbar — everything on this page follows.
   -------------------------------------------------------------------------- */

const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const;
const BUTTON_SIZES = ['sm', 'md', 'lg'] as const;
const BADGE_VARIANTS = ['neutral', 'accent', 'success', 'warning', 'danger'] as const;

const PRINCIPLES = [
    'Glass over paint',
    'One beam of colour',
    'Night-first',
    'Calm motion',
    'Legible always'
];

interface SwatchProps {
    name: string;
    cssVar: string;
}

const Swatch: React.FC<SwatchProps> = ({ name, cssVar }) => (
    <div className="ds-swatch">
        <div className="ds-swatch__chip" style={{ background: `var(${cssVar})` }} />
        <div className="ds-swatch__meta">
            <span className="ds-swatch__name">{name}</span>
            <code className="ds-swatch__var">{cssVar}</code>
        </div>
    </div>
);

interface SectionProps {
    kicker: string;
    title: string;
    lede: string;
    children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ kicker, title, lede, children }) => (
    <section className="ds-section container">
        <p className="ds-kicker">{kicker}</p>
        <h2 className="ds-section__title">{title}</h2>
        <p className="ds-section__lede">{lede}</p>
        {children}
    </section>
);

const DesignSystem: React.FC = () => {
    return (
        <div className="ds-page">
            {/* ---- Identity ------------------------------------------------ */}
            <header className="ds-hero container">
                <Badge variant="accent">Design system · v1</Badge>
                <h1 className="ds-hero__title">
                    <span className="ds-hero__gradient">Iris</span>
                </h1>
                <p className="ds-hero__lede">
                    Indigo light through dark glass. Iris is the visual language of this
                    template: glass surfaces floating on a night backdrop, a single
                    indigo-to-violet beam of accent colour, and type that stays calm at
                    every size. Toggle the theme — every token on this page follows.
                </p>
                <div className="ds-hero__principles">
                    {PRINCIPLES.map(p => <Badge key={p} variant="neutral">{p}</Badge>)}
                </div>
            </header>

            {/* ---- Colour --------------------------------------------------- */}
            <Section
                kicker="Tokens / Colour"
                title="One beam of colour"
                lede="Semantic roles, themed for light and dark. Components never touch hex values — only these roles."
            >
                <div className="ds-panel">
                    <h3 className="ds-group-title">Accent</h3>
                    <div className="ds-swatch-grid">
                        <Swatch name="Accent" cssVar="--accent-primary" />
                        <Swatch name="Accent alt" cssVar="--accent-secondary" />
                        <Swatch name="Accent hover" cssVar="--accent-hover" />
                        <Swatch name="Accent soft" cssVar="--accent-soft" />
                        <Swatch name="Focus ring" cssVar="--focus-ring" />
                        <div className="ds-swatch">
                            <div className="ds-swatch__chip" style={{ background: 'var(--gradient-accent)' }} />
                            <div className="ds-swatch__meta">
                                <span className="ds-swatch__name">The beam</span>
                                <code className="ds-swatch__var">--gradient-accent</code>
                            </div>
                        </div>
                    </div>

                    <h3 className="ds-group-title">Surfaces &amp; borders</h3>
                    <div className="ds-swatch-grid">
                        <Swatch name="Page" cssVar="--bg-page" />
                        <Swatch name="Glass card" cssVar="--bg-card" />
                        <Swatch name="Glass raised" cssVar="--glass-hover-bg" />
                        <Swatch name="Border" cssVar="--glass-border" />
                        <Swatch name="Border strong" cssVar="--border-strong" />
                    </div>

                    <h3 className="ds-group-title">Text</h3>
                    <div className="ds-text-samples">
                        <p style={{ color: 'var(--text-primary)' }}>Primary — headlines and body <code>--text-primary</code></p>
                        <p style={{ color: 'var(--text-secondary)' }}>Secondary — supporting copy <code>--text-secondary</code></p>
                        <p style={{ color: 'var(--text-muted)' }}>Muted — placeholders, hints <code>--text-muted</code></p>
                    </div>

                    <h3 className="ds-group-title">Status</h3>
                    <div className="ds-swatch-grid">
                        <Swatch name="Success" cssVar="--success" />
                        <Swatch name="Warning" cssVar="--warning" />
                        <Swatch name="Danger" cssVar="--danger" />
                        <Swatch name="Success soft" cssVar="--success-soft" />
                        <Swatch name="Warning soft" cssVar="--warning-soft" />
                        <Swatch name="Danger soft" cssVar="--danger-soft" />
                    </div>
                </div>
            </Section>

            {/* ---- Type ----------------------------------------------------- */}
            <Section
                kicker="Tokens / Type"
                title="Type scale"
                lede="Inter for reading, Outfit for display. Eight sizes; the top two are fluid clamps."
            >
                <div className="ds-panel">
                    <div className="ds-type-row">
                        <code className="ds-type-token">--text-display</code>
                        <span className="ds-type-sample ds-type-sample--display" style={{ fontSize: 'var(--text-display)' }}>Iris</span>
                    </div>
                    <div className="ds-type-row">
                        <code className="ds-type-token">--text-3xl</code>
                        <span className="ds-type-sample ds-type-sample--display" style={{ fontSize: 'var(--text-3xl)' }}>Refraction</span>
                    </div>
                    <div className="ds-type-row">
                        <code className="ds-type-token">--text-2xl · 2rem</code>
                        <span className="ds-type-sample ds-type-sample--display" style={{ fontSize: 'var(--text-2xl)' }}>Section headings</span>
                    </div>
                    <div className="ds-type-row">
                        <code className="ds-type-token">--text-xl · 1.5rem</code>
                        <span className="ds-type-sample ds-type-sample--display" style={{ fontSize: 'var(--text-xl)' }}>Card titles</span>
                    </div>
                    <div className="ds-type-row">
                        <code className="ds-type-token">--text-lg · 1.25rem</code>
                        <span className="ds-type-sample" style={{ fontSize: 'var(--text-lg)' }}>Ledes and pull quotes</span>
                    </div>
                    <div className="ds-type-row">
                        <code className="ds-type-token">--text-md · 1rem</code>
                        <span className="ds-type-sample" style={{ fontSize: 'var(--text-md)' }}>Body copy, the default reading size</span>
                    </div>
                    <div className="ds-type-row">
                        <code className="ds-type-token">--text-sm · 0.875rem</code>
                        <span className="ds-type-sample" style={{ fontSize: 'var(--text-sm)' }}>Secondary copy, labels, nav links</span>
                    </div>
                    <div className="ds-type-row">
                        <code className="ds-type-token">--text-xs · 0.75rem</code>
                        <span className="ds-type-sample" style={{ fontSize: 'var(--text-xs)' }}>Badges, captions, fine print</span>
                    </div>
                </div>
            </Section>

            {/* ---- Elevation & radius --------------------------------------- */}
            <Section
                kicker="Tokens / Depth"
                title="Elevation & radius"
                lede="Three shadow steps plus an accent glow for the one thing that matters most on a screen."
            >
                <div className="ds-panel">
                    <div className="ds-elevation-grid">
                        <div className="ds-elevation" style={{ boxShadow: 'var(--shadow-1)' }}><code>--shadow-1</code><span>resting</span></div>
                        <div className="ds-elevation" style={{ boxShadow: 'var(--shadow-2)' }}><code>--shadow-2</code><span>hover lift</span></div>
                        <div className="ds-elevation" style={{ boxShadow: 'var(--shadow-3)' }}><code>--shadow-3</code><span>overlays</span></div>
                        <div className="ds-elevation" style={{ boxShadow: 'var(--shadow-glow)' }}><code>--shadow-glow</code><span>the hero move</span></div>
                    </div>
                    <h3 className="ds-group-title">Radius</h3>
                    <div className="ds-radius-grid">
                        <div className="ds-radius" style={{ borderRadius: 'var(--radius-sm)' }}><code>sm · 8</code></div>
                        <div className="ds-radius" style={{ borderRadius: 'var(--radius-md)' }}><code>md · 12</code></div>
                        <div className="ds-radius" style={{ borderRadius: 'var(--radius-lg)' }}><code>lg · 16</code></div>
                        <div className="ds-radius" style={{ borderRadius: 'var(--radius-xl)' }}><code>xl · 24</code></div>
                        <div className="ds-radius" style={{ borderRadius: 'var(--radius-pill)' }}><code>pill</code></div>
                    </div>
                </div>
            </Section>

            {/* ---- Buttons --------------------------------------------------- */}
            <Section
                kicker="Primitives / Button"
                title="Buttons"
                lede="Four variants, three sizes, plus disabled and loading. Primary carries the beam; everything else stays glass."
            >
                <div className="ds-panel">
                    {BUTTON_VARIANTS.map(variant => (
                        <div className="ds-button-row" key={variant}>
                            <code className="ds-row-label">{variant}</code>
                            <div className="ds-row-items">
                                {BUTTON_SIZES.map(size => (
                                    <Button key={size} variant={variant} size={size}>
                                        {size === 'sm' ? 'Small' : size === 'md' ? 'Medium' : 'Large'}
                                    </Button>
                                ))}
                                <Button variant={variant} disabled>Disabled</Button>
                                <Button variant={variant} loading>Loading</Button>
                            </div>
                        </div>
                    ))}
                </div>
            </Section>

            {/* ---- Badges ----------------------------------------------------- */}
            <Section
                kicker="Primitives / Badge"
                title="Badges"
                lede="Soft tints on glass — status without shouting."
            >
                <div className="ds-panel">
                    <div className="ds-row-items">
                        {BADGE_VARIANTS.map(variant => (
                            <Badge key={variant} variant={variant}>{variant}</Badge>
                        ))}
                    </div>
                </div>
            </Section>

            {/* ---- Cards ------------------------------------------------------ */}
            <Section
                kicker="Primitives / Card"
                title="Cards"
                lede="Panes of glass. Optional hover-lift, optional header/body/footer composition."
            >
                <div className="ds-card-grid">
                    <Card>
                        <CardBody>
                            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Plain glass</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                                The resting surface. Content floats behind a 12px blur.
                            </p>
                        </CardBody>
                    </Card>
                    <Card hover>
                        <CardBody>
                            <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>Hover lift</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                                Hover me — a 6px lift with an indigo hairline. Reserved for interactive cards.
                            </p>
                        </CardBody>
                    </Card>
                    <Card>
                        <CardHeader>Composed</CardHeader>
                        <CardBody>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                                Header, body and footer sections with hairline separators.
                            </p>
                        </CardBody>
                        <CardFooter>
                            <Badge variant="success">healthy</Badge>
                        </CardFooter>
                    </Card>
                </div>
            </Section>

            {/* ---- Inputs ------------------------------------------------------ */}
            <Section
                kicker="Primitives / Input"
                title="Inputs"
                lede="Always labelled. Focus draws the ring; errors speak in the danger role."
            >
                <div className="ds-panel">
                    <div className="ds-input-grid">
                        <Input
                            label="Project name"
                            placeholder="e.g. northstar"
                            helperText="Lowercase, no spaces."
                        />
                        <Input
                            label="Email"
                            type="email"
                            defaultValue="not-an-email"
                            error="That doesn't look like an email address."
                        />
                        <Input
                            label="API key"
                            placeholder="Disabled until connected"
                            disabled
                            helperText="Connect the backend first."
                        />
                    </div>
                </div>
            </Section>
        </div>
    );
};

export default DesignSystem;
