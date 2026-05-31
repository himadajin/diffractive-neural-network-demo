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
The viewer-facing input to the Artwork: a digit drawn directly by the viewer onto the circular first optical surface of the Optical Bench. Development presets may exist, but they are not part of the viewer-facing Artwork.
_Avoid_: Preset selector, auto-play source

**Exhibition UI**:
The viewer-facing controls of the Artwork, limited to drawing, clearing, and seeing the optical result.
_Avoid_: Settings panel, explanation panel, preset selector

**Development Controls**:
Non-exhibition controls used to test and debug the Artwork, such as presets, diagnostics, model confidence inspection, or numeric camera controls. They may expose reproducible parameter values but must stay outside the viewer-facing Exhibition UI.
_Avoid_: Viewer-facing controls

**Camera Debug Controls**:
A minimal Development Controls surface for adjusting and reading the Optical Bench camera position, target, and field of view with numeric inputs. It exists so visual composition can be discussed with exact numeric parameters without adding exhibition-facing controls.
_Avoid_: Exhibition camera navigation, viewer-facing orbit controls

**Prototype Rendering**:
The initial rendering approach for the Artwork, using a simplified Canvas-based version to establish visual direction before investing in more detailed glass rendering.
_Avoid_: Final visual fidelity

**Primary Display**:
The first target presentation format for the Artwork: a desktop or exhibition-style landscape screen. Mobile support is important later, but should not drive the initial composition.
_Avoid_: Mobile-first layout

**Optical Bench**:
The viewer-facing spatial arrangement of the Artwork, shown as a fixed-camera three-dimensional sequence of input surface, four Relief Lens Layers, and one Output Screen. The components sit along a single optical axis and each surface is perpendicular to that axis, while the viewer-facing camera angle preserves readability.
_Avoid_: Flat diagram, free camera 3D scene

**Relief Lens Layer**:
One of four fixed circular optical elements with visible surface relief, like a learned lens in a telescope-like or microscope-like light circuit. Each layer changes the meaning and distribution of light passing through it, while the layer itself does not change when the Handwritten Input changes. Its relief should primarily read as continuous optical structure, with only subtle learned irregularity.
_Avoid_: Animated layer, changing lens, abstract neural-network layer, flat glass plate

**Diffraction Pattern**:
The luminous field shown on each optical surface as the primary visual expression of light changing through the Artwork.
_Avoid_: Laser ray

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
The faint resting illumination of the Optical Bench before the viewer draws: subtle glass edges, input-surface reflections, and weak receptor light without showing a preset digit.
_Avoid_: Blank screen, sample input

**Output Screen**:
The final passive, opaque projection surface of the Artwork, marked with upright printed digits 0 through 9 arranged around a circle. The screen does not perform classification; the Relief Lens Layers determine where light lands.
_Avoid_: Active receptor array, transparent screen, dashboard, classifier display

**Confidence Glow**:
The brightness landing on each printed digit mark of the Output Screen, corresponding to how strongly the Artwork treats that digit as a candidate result.
_Avoid_: Winner-only output

**Response Timing**:
The Artwork's temporal behavior: Handwritten Input and intermediate light patterns respond immediately, while Confidence Glow follows smoothly with slight inertia.
_Avoid_: Delayed batch result, flickering output

**Classifier**:
The learned digit recognizer that produces candidate strengths for the Detector Array from the Handwritten Input. It is separate from the Visual Plausibility Simulation.
_Avoid_: Optical solver

## Example Dialogue

Dev: "Should the Artwork explain how optical neural networks work?"
Domain expert: "Only enough for the visual logic to feel coherent. The Artwork should first read as visual art."

Dev: "Does the Visual Plausibility Simulation need to be physically exact?"
Domain expert: "No. It needs to respond to input in a way that produces beautiful, believable light behavior."

Dev: "Should viewers choose from preset digits?"
Domain expert: "No. The Artwork should expose only Handwritten Input. Presets are acceptable for development and debugging, but not as exhibition UI."

Dev: "Can the screen show model diagnostics?"
Domain expert: "Only as Development Controls. The Exhibition UI should stay limited to drawing, clearing, and the optical result."

Dev: "Should viewers be able to move the camera?"
Domain expert: "No. Camera Debug Controls may exist behind a debug flag, but the Artwork itself has a fixed camera."

Dev: "Does the first implementation need final-quality glass?"
Domain expert: "No. Prototype Rendering should establish the composition and behavior first, while preserving the importance of high-quality glass in the final Artwork."

Dev: "Is the scene a full 3D environment?"
Domain expert: "No. It is an Optical Bench: a fixed 3D composition whose input surface, Relief Lens Layers, and Output Screen read as one physically plausible optical path."

Dev: "Can the screen be rotated separately to make the digits easier to read?"
Domain expert: "No. The screen belongs to the same optical axis as the lenses; readability should come from camera composition rather than breaking the physical arrangement."

Dev: "Do the optical layers change for each input?"
Domain expert: "No. The Relief Glass Layers are fixed physical-looking elements. The light passing through them changes."

Dev: "Should the Artwork show light as laser lines or object shadows?"
Domain expert: "No. The main light expression is the Diffraction Pattern, reflected highlights, Relief Shading, and brightness on the Output Screen; Guiding Beams are only for restrained development cues."

Dev: "Should the light be rainbow-colored?"
Domain expert: "No. The Light Palette should stay mostly cool white to cyan, with only restrained spectral accents."

Dev: "What should the viewer see before drawing?"
Domain expert: "The Optical Bench should show Idle Glow, not a blank screen or a preset digit."

Dev: "Should only the predicted digit light up?"
Domain expert: "No. The Output Screen should show Confidence Glow for all ten digits, so ambiguous Handwritten Input can produce multiple visible candidates."

Dev: "Should the result update only after drawing finishes?"
Domain expert: "No. Response Timing should feel live, with only the Confidence Glow smoothed to avoid flicker."

Dev: "Does the optical simulation itself classify the digit?"
Domain expert: "No. A Classifier provides the candidate strengths, and the Artwork uses them to drive the Confidence Glow on the Output Screen."
