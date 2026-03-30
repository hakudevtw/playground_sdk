// biome-ignore lint/style/useFilenamingConvention: filename should be in kebab-case
/** biome-ignore-all lint/performance/noImgElement: images are not optimized */
import { useState } from "react";
import heroImg from "./assets/hero.png";
import reactLogo from "./assets/react.svg";
import viteLogo from "./assets/vite.svg";
import "./App.css";

function App() {
	const [count, setCount] = useState(0);

	return (
		<>
			<section id="center">
				<div className="hero">
					<img alt="" className="base" height="179" src={heroImg} width="170" />
					<img
						alt="React logo"
						className="framework"
						height="28"
						src={reactLogo}
						width="28"
					/>
					<img
						alt="Vite logo"
						className="vite"
						height="26"
						src={viteLogo}
						width="26"
					/>
				</div>
				<div>
					<h1>Get started</h1>
					<p>
						Edit <code>src/App.tsx</code> and save to test <code>HMR</code>
					</p>
				</div>
				<button
					className="counter"
					data-track
					onClick={() => setCount((count) => count + 1)}
					type="button"
				>
					Count is {count}
				</button>
			</section>

			<div className="ticks" />

			<section id="next-steps">
				<div id="docs">
					<svg aria-hidden="true" className="icon" role="presentation">
						<use href="/icons.svg#documentation-icon" />
					</svg>
					<h2>Documentation</h2>
					<p>Your questions, answered</p>
					<ul>
						<li>
							<a href="https://vite.dev/" rel="noopener" target="_blank">
								<img
									alt=""
									className="logo"
									height="22"
									src={viteLogo}
									width="22"
								/>
								Explore Vite
							</a>
						</li>
						<li>
							<a href="https://react.dev/" rel="noopener" target="_blank">
								<img
									alt=""
									className="button-icon"
									height="28"
									src={reactLogo}
									width="28"
								/>
								Learn more
							</a>
						</li>
					</ul>
				</div>
				<div id="social">
					<svg aria-hidden="true" className="icon" role="presentation">
						<use href="/icons.svg#social-icon" />
					</svg>
					<h2>Connect with us</h2>
					<p>Join the Vite community</p>
					<ul>
						<li>
							<a
								href="https://github.com/vitejs/vite"
								rel="noopener"
								target="_blank"
							>
								<svg
									aria-hidden="true"
									className="button-icon"
									role="presentation"
								>
									<use href="/icons.svg#github-icon" />
								</svg>
								GitHub
							</a>
						</li>
						<li>
							<a href="https://chat.vite.dev/" rel="noopener" target="_blank">
								<svg
									aria-hidden="true"
									className="button-icon"
									role="presentation"
								>
									<use href="/icons.svg#discord-icon" />
								</svg>
								Discord
							</a>
						</li>
						<li>
							<a href="https://x.com/vite_js" rel="noopener" target="_blank">
								<svg
									aria-hidden="true"
									className="button-icon"
									role="presentation"
								>
									<use href="/icons.svg#x-icon" />
								</svg>
								X.com
							</a>
						</li>
						<li>
							<a
								href="https://bsky.app/profile/vite.dev"
								rel="noopener"
								target="_blank"
							>
								<svg
									aria-hidden="true"
									className="button-icon"
									role="presentation"
								>
									<use href="/icons.svg#bluesky-icon" />
								</svg>
								Bluesky
							</a>
						</li>
					</ul>
				</div>
			</section>

			<div className="ticks" />
			<section id="spacer" />
		</>
	);
}

export default App;
