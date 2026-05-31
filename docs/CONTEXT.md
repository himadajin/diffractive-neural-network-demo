# Diffractive Neural Network Artwork

This context describes the language for an interactive visual artwork themed around optical diffraction and neural networks.

## Language

**Artwork**:
An interactive visual piece whose primary purpose is an aesthetically compelling experience using diffraction and neural-network imagery.
_Avoid_: Educational demo, research simulator

**Visual Plausibility Simulation**:
A lightweight simulation used to make the artwork's light behavior look coherent with its input and theme. It is not a physically rigorous optical model.
_Avoid_: Accurate diffraction solver, scientific simulation

**Handwritten Input**:
The digit data drawn by the viewer through the Drawing Panel and reflected live onto the Input Surface. Development presets may exist, but they are not part of the viewer-facing Artwork.
_Avoid_: Preset selector, auto-play source, direct 3D surface manipulation

**Canonical Input Orientation**:
The shared left/right and top/bottom meaning of the Handwritten Input: a digit is upright exactly as the viewer draws it in the Drawing Panel. The Input Surface, Diffraction Pattern, and Classifier all refer to this same handedness, even when camera perspective changes how the optical surface appears.
_Avoid_: Mirrored input, back-side input, classifier-only orientation, surface-local handedness

**Drawing Panel**:
The viewer-facing two-dimensional drawing surface used to create the Handwritten Input. It belongs to the Exhibition UI, not the optical instrument, and contains the clearing control; when collapsed, clearing does not need a separate visible control. The panel opens from the Input Surface but remains layout-independent from it, so drawing stays practical without displacing the real-time optical response or the Optical Bench's visual presence.
_Avoid_: 3D object drawing, optical component, settings panel, preset selector, global clear button, hidden input affordance, close-button chrome, connector line, callout tether

**Input Surface**:
The first circular optical surface of the Optical Bench, carrying the live visual imprint of the Handwritten Input into the optical path. When the Drawing Panel is collapsed, it acts as the visual affordance for opening the panel, while remaining part of the optical instrument rather than the surface the viewer draws on directly.
_Avoid_: Drawing panel, control canvas, classifier input widget

**Exhibition UI**:
The viewer-facing controls of the Artwork, limited to drawing, clearing, and seeing the optical result.
_Avoid_: Settings panel, explanation panel, preset selector

**Development Controls**:
Non-exhibition controls used to test and debug the Artwork, such as presets, diagnostics, model confidence inspection, or numeric camera controls. They may expose reproducible parameter values but must stay outside the viewer-facing Exhibition UI.
_Avoid_: Viewer-facing controls

**Camera Debug Controls**:
A minimal Development Controls surface for adjusting and reading the Optical Bench camera position, target, and field of view with numeric inputs. It exists so visual composition can be discussed with exact numeric parameters without adding exhibition-facing controls.
_Avoid_: Exhibition camera navigation, viewer-facing orbit controls

**Fixed Bench View Angle**:
The stable viewing relationship between the Exhibition camera and the Depth-Aligned Optical Bench: the optical axis keeps the same apparent angle across presentation sizes and Drawing Panel states. Readability may be preserved through framing scale, spacing, transparency, and size choices, but not by switching the camera's viewing angle.
_Avoid_: Breakpoint camera angle, panel-driven camera angle, layout-dependent view direction

**Responsive Fixed Camera**:
The Artwork's non-interactive camera framing, chosen by presentation size so the Depth-Aligned Optical Bench remains readable without exposing viewer-facing camera controls. It preserves the Fixed Bench View Angle; responsive adaptation may change framing scale or screen placement, but not the camera's viewing direction relative to the optical axis.
_Avoid_: Orbit controls, free camera, viewer-adjustable camera

**Prototype Rendering**:
The initial rendering approach for the Artwork, using a simplified Canvas-based version to establish visual direction before investing in more detailed glass rendering.
_Avoid_: Final visual fidelity

**Responsive Presentation**:
The target presentation approach for the Artwork: desktop, exhibition-style landscape screens, tablets, and mobile screens should all preserve the same Optical Bench identity and remain fully usable. No presentation size is a secondary fallback.
_Avoid_: Desktop-only composition, mobile-later layout, flat mobile diagram

**Whole Path Readability**:
The presentation requirement that the Handwritten Input, Relief Lens Layers, and Output Screen remain visible together as one continuous optical path across supported screen sizes.
_Avoid_: Step-by-step view, hidden output, input-only mobile mode

**Optical Bench**:
The viewer-facing spatial arrangement of the Artwork, shown as a fixed-camera three-dimensional sequence of Input Surface, four Relief Lens Layers, and one Output Screen. The components sit along a single optical axis and each surface is perpendicular to that axis; readability must come from presentation choices rather than rotating individual surfaces away from the optical path.
_Avoid_: Flat diagram, free camera 3D scene

**Optical Instrument Coherence**:
The physical believability of the Optical Bench as an object that could exist: surfaces remain centered on the same optical axis and are not specially repositioned to face the camera or cheat readability.
_Avoid_: Camera-facing lens layout, fanned layers, physically broken optical apparatus

**Depth-Aligned Optical Bench**:
An Optical Bench composition where the optical axis advances from the viewer-facing foreground into scene depth, like a microscope-like light path, while still keeping the Handwritten Input, Relief Lens Layers, and Output Screen readable.
_Avoid_: Side-on rail diagram, top-to-bottom flat stack

**Propagation Direction**:
The optical direction of the Artwork: the Handwritten Input enters from the viewer-facing Input Surface and progresses through Relief Lens Layers toward the Output Screen in scene depth. It is independent of screen-space axes and must not be confused with texture or classifier orientation.
_Avoid_: Left-to-right flow, screen-vertical flow, camera direction, texture orientation

**Relief Lens Layer**:
One of four fixed circular optical elements with visible surface relief, like a learned lens in a telescope-like or microscope-like light circuit. Each layer changes the meaning and distribution of light passing through it, while the layer itself does not change when the Handwritten Input changes. Its relief should primarily read as continuous optical structure, with only subtle learned irregularity.
_Avoid_: Animated layer, changing lens, abstract neural-network layer, flat glass plate

**Diffraction Pattern**:
The luminous field shown on each optical surface as the primary visual expression of light changing through the Artwork. It originates from the Handwritten Input and gradually organizes toward the candidate digits suggested by the Classifier, without claiming to be a physically exact diffraction calculation.
_Avoid_: Laser ray

**Projected Light Field**:
The information-bearing light visible on the Input Surface and Relief Lens Layers. It may appear as a low-resolution cell field while the optical surface itself keeps high-fidelity glass, relief, reflection, and shadow qualities.
_Avoid_: Pixelated lens, raw pasted input, texture resolution, UI preview

**Luminous Cell Field**:
A Projected Light Field whose visible information is carried by an array of glowing cells rather than by a pasted bitmap. On the Input Surface it can represent the same normalized input seen by the Classifier while still reading as light caught in glass; visible grid lines should not compete with the optical surface.
_Avoid_: Pixel art sticker, sharp nearest-neighbor image, flat preview, drawn grid, deliberate cell spacing

**Input Mask**:
The dark, light-blocking appearance of the Handwritten Input as it enters the optical path. It should preserve the Drawing Panel's stable input position while reading as optical masking on glass, not as blue ink or a glowing digit.
_Avoid_: Glowing handwriting, colored marker, UI ink, recentered display mask

**Monochrome Light Field**:
A Projected Light Field whose primary contrast is blocked darkness against transmitted white light. It may use subtle cool glass tints, but the optical information should read mainly through black, white, and gray values.
_Avoid_: Blue-only propagation, colored feature map, neon light path

**Relief-Revealed Cell Field**:
A Luminous Cell Field whose cells appear to emerge from light interacting with glass relief, reflection, and subtle interference on the optical surface. The cells should not read as directly drawn squares with graphic edge treatment.
_Avoid_: Softened pixel image, edge-faded cell, rounded pixel, visible cell border

**Resolution Progression**:
The visual change in Projected Light Field density across the Optical Bench: the input begins as a normalized low-resolution cell field, may expand into a finer circuit-like field, then compress toward candidate output regions. It is an artistic structure for optical readability and performance, not an explanation of the Classifier's internal layers.
_Avoid_: Neural-network layer diagram, exact CNN feature map, fixed-resolution pipeline

**Circuit-Like Light Field**:
A finer Projected Light Field where light appears to branch and organize along the Relief Lens Layer's fixed optical structure. It should read as light being routed through a surface, not as a higher-resolution copy of the Handwritten Input.
_Avoid_: Upscaled input image, feature-map diagram, decorative circuit board

**Feature-Bundle Light Field**:
A compressed Projected Light Field where routed light gathers into clusters that suggest digit parts such as arcs, strokes, and turns. It should imply recognition taking shape without becoming a labeled model feature map.
_Avoid_: CNN feature map, labeled stroke detector, direct digit reconstruction

**Candidate-Splitting Light Field**:
A late-stage Projected Light Field where gathered light divides toward multiple candidate digit regions before reaching the Output Screen. The strongest candidate may dominate, but weaker alternatives should remain visible as optical evidence rather than disappearing.
_Avoid_: Winner-only beam, probability chart, visible laser fan

**Guiding Beam**:
A development-only or highly restrained directional cue between optical surfaces. The Artwork should express propagation primarily through light landing on lens surfaces, relief shading, reflections, and changing diffraction patterns rather than visible connecting lines or component cast shadows.
_Avoid_: Viewer-facing light rays, primary light visualization

**Light Palette**:
The Artwork's restrained light color language: a quiet white-based environment with cool white light, pale cyan highlights, and subtle spectral color only at lens edges, interference details, and strong output highlights. The environment should not visually compete with the glass relief or projected shadows.
_Avoid_: Dark background, warm exhibition lighting, full rainbow palette, AI neon palette

**Quiet White Environment**:
The understated white to light-gray spatial setting behind the Optical Bench. It exists as a quiet negative space for the optical components, reflections, and projected light without becoming a visual subject of the Artwork.
_Avoid_: Decorative background, warm booth lighting, information panel

**Relief Shading**:
The subtle local light and shadow produced by surface relief on the Handwritten Input and Relief Lens Layers. It is part of the material quality of the optical elements, unlike component cast shadows on the environment.
_Avoid_: Drop shadow, decorative shadow

**Idle Glow**:
The faint resting illumination of the Optical Bench before the viewer draws: subtle glass edges and input-surface reflections without any Confidence Glow on the Output Screen.
_Avoid_: Blank screen, sample input, resting result glow

**Output Screen**:
The final passive, opaque projection surface of the Artwork, marked with upright printed digits 0 through 9 arranged around a circle. The screen does not perform classification; the Relief Lens Layers determine where light lands.
_Avoid_: Active receptor array, transparent screen, dashboard, classifier display

**Confidence Glow**:
The brightness landing on each printed digit mark of the Output Screen, corresponding to how strongly the Artwork treats that digit as a candidate result. It should read as brighter or dimmer digits in fixed positions, not as larger color fields around digits.
_Avoid_: Winner-only output, probability halo, expanding color field

**Response Timing**:
The Artwork's temporal behavior: Handwritten Input and intermediate light patterns respond immediately, while Confidence Glow follows smoothly with slight inertia.
_Avoid_: Delayed batch result, flickering output

**Optical Settling**:
The temporal character of the light circuit as the Diffraction Pattern responds immediately to Handwritten Input and then gradually organizes toward the Classifier's candidate strengths. It should feel like light resolving through the Optical Bench, not like a delayed result appearing after computation.
_Avoid_: Result pop-in, loading reveal, classifier handoff, flickering correction

**Classifier**:
The learned digit recognizer that produces candidate strengths for the Confidence Glow on the Output Screen from the Handwritten Input. It is separate from the Visual Plausibility Simulation.
_Avoid_: Optical solver

**Classifier Normalization**:
The preparation of Handwritten Input for the Classifier while preserving Canonical Input Orientation. It may make the digit easier for the learned recognizer to read, but it is not a second source of truth or a place to repair optical-surface orientation.
_Avoid_: Mirror correction, display correction, classifier-space drawing, hidden input transform

**Local Classifier Runtime**:
The packaged browser-side runtime and learned digit-recognition model used by the Classifier. It is bundled with the Artwork so recognition does not depend on an external network service during viewing.
_Avoid_: CDN-dependent model, server-side recognizer, remote API

## Example Dialogue

Dev: "Should the Artwork explain how optical neural networks work?"
Domain expert: "Only enough for the visual logic to feel coherent. The Artwork should first read as visual art."

Dev: "Does the Visual Plausibility Simulation need to be physically exact?"
Domain expert: "No. It needs to respond to input in a way that produces beautiful, believable light behavior."

Dev: "Should viewers choose from preset digits?"
Domain expert: "No. The Artwork should expose only Handwritten Input through the Drawing Panel. Presets are acceptable for development and debugging, but not as exhibition UI."

Dev: "Should viewers draw directly on the 3D optical surface?"
Domain expert: "No. The Drawing Panel is the manipulation surface; the Input Surface carries the live imprint into the Optical Bench."

Dev: "Does touching the Input Surface create ink directly on the 3D surface?"
Domain expert: "No. Touching the Input Surface opens the Drawing Panel; ink is created through the Drawing Panel and reflected live onto the Input Surface."

Dev: "How does the viewer open the Drawing Panel?"
Domain expert: "By touching or clicking the Input Surface. The affordance should be visual and restrained, not an extra explanatory button."

Dev: "Can the Drawing Panel collapse?"
Domain expert: "Yes. It may collapse when presentation space is tight, especially on mobile, as long as the input affordance remains visible and it does not become a settings panel."

Dev: "Should a separate 2D input preview remain visible while the Drawing Panel is collapsed?"
Domain expert: "No. The collapsed affordance is the Input Surface itself; adding a separate preview would compete with the Optical Bench."

Dev: "How does the Drawing Panel close?"
Domain expert: "By returning focus to the Optical Bench, such as tapping outside the panel; desktop keyboard escape may also close it."

Dev: "Should Clear be a separate global button?"
Domain expert: "No. Clear belongs inside the Drawing Panel, and it does not need to remain visible while the panel is collapsed."

Dev: "Does reopening the Drawing Panel start from a blank drawing?"
Domain expert: "No. Reopening the Drawing Panel should show the current Handwritten Input so the viewer can continue editing it; clearing is explicit."

Dev: "Can the Drawing Panel, Input Surface, and Classifier each keep separate versions of the input?"
Domain expert: "No. The Handwritten Input should have one source of truth so the Drawing Panel, Input Surface, and optical response all reflect the same drawing."

Dev: "If the Input Surface is seen at an angle, should the Classifier flip the digit because the optical component has a front and back?"
Domain expert: "No. Canonical Input Orientation stays viewer-upright: a drawn 2 must remain a 2 for the Drawing Panel, Input Surface, Diffraction Pattern, and Classifier."

Dev: "Should the Drawing Panel become large enough to prioritize beautiful handwriting?"
Domain expert: "No. The Artwork is about real-time optical feedback, so the Drawing Panel should remain practical without sacrificing the visible Optical Bench."

Dev: "Can the screen show model diagnostics?"
Domain expert: "Only as Development Controls. The Exhibition UI should stay limited to drawing, clearing, and the optical result."

Dev: "Should viewers be able to move the camera?"
Domain expert: "No. Camera Debug Controls may exist behind a debug flag, but the Artwork itself has a fixed camera."

Dev: "Can the fixed camera change for different screen sizes?"
Domain expert: "Yes, but only as framing. A Responsive Fixed Camera should preserve the Fixed Bench View Angle so the optical axis does not feel like it rotates between screen sizes."

Dev: "Can opening the Drawing Panel change the camera angle to make more room?"
Domain expert: "No. The Drawing Panel belongs to the Exhibition UI; it may overlay the Artwork, but it should not drive a new view angle for the Optical Bench."

Dev: "Can mobile show only the drawing surface while the viewer draws?"
Domain expert: "No. Whole Path Readability matters across supported screen sizes: the input, intermediate lenses, and output should remain visible together."

Dev: "Does the first implementation need final-quality glass?"
Domain expert: "No. Prototype Rendering should establish the composition and behavior first, while preserving the importance of high-quality glass in the final Artwork."

Dev: "Is the scene a full 3D environment?"
Domain expert: "No. It is an Optical Bench: a fixed 3D composition whose Input Surface, Relief Lens Layers, and Output Screen read as one physically plausible optical path."

Dev: "Can the lenses be shifted sideways or fanned out so the camera can see them better?"
Domain expert: "No. Optical Instrument Coherence matters: readability should come from camera composition, spacing, transparency, and scale, not from physically impossible layer placement."

Dev: "Should the optical path read as a left-to-right rail?"
Domain expert: "No. A Depth-Aligned Optical Bench is preferred: the light path should advance from the viewer-facing foreground into scene depth, while preserving readability of the input, intermediate lenses, and output."

Dev: "Does Propagation Direction define the digit's left and right?"
Domain expert: "No. Propagation Direction describes where light travels in the Optical Bench; Canonical Input Orientation describes how the Handwritten Input is read."

Dev: "Can the screen be rotated separately to make the digits easier to read?"
Domain expert: "No. The screen belongs to the same optical axis as the lenses; readability should come from camera composition rather than breaking the physical arrangement."

Dev: "Do the optical layers change for each input?"
Domain expert: "No. The Relief Lens Layers are fixed physical-looking elements. The light passing through them changes."

Dev: "Should the Artwork show light as laser lines or object shadows?"
Domain expert: "No. The main light expression is the Diffraction Pattern, reflected highlights, Relief Shading, and brightness on the Output Screen; Guiding Beams are only for restrained development cues."

Dev: "Should the light be rainbow-colored?"
Domain expert: "No. The Light Palette should stay mostly cool white to cyan, with only restrained spectral accents."

Dev: "What should the viewer see before drawing?"
Domain expert: "The Optical Bench should show Idle Glow, not a blank screen or a preset digit, and the Output Screen should not show Confidence Glow before input."

Dev: "Should only the predicted digit light up?"
Domain expert: "No. The Output Screen should show Confidence Glow for all ten digits, so ambiguous Handwritten Input can produce multiple visible candidates."

Dev: "Should the result update only after drawing finishes?"
Domain expert: "No. Response Timing should feel live, with only the Confidence Glow smoothed to avoid flicker."

Dev: "Does the optical simulation itself classify the digit?"
Domain expert: "No. A Classifier provides the candidate strengths, and the Artwork uses them to drive the Confidence Glow on the Output Screen."

Dev: "Can Classifier Normalization mirror or rotate the Handwritten Input if it improves recognition?"
Domain expert: "No. It may prepare the input for recognition, but it must preserve Canonical Input Orientation so a drawn digit is not interpreted as its mirror image."

Dev: "Should intermediate lens patterns only be blurred copies of the input?"
Domain expert: "No. The Diffraction Pattern should remain input-derived, but later layers should visually organize toward the candidate digits indicated by the Classifier."

Dev: "Can digit recognition depend on a remote model service?"
Domain expert: "No. The Classifier should use a Local Classifier Runtime so the Artwork remains reproducible in exhibition and local viewing contexts."
