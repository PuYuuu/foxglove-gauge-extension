# foxglove-gauge-extension version history

## 1.0.0

### New Features

#### 1. Speedometer Component
- Real-time vehicle speed visualization with customizable gauge
- Configurable min/max value ranges and smooth needle animation

#### 2. SteeringWheel Component
- Interactive steering wheel angle visualization
- Optional angle value display with real-time rotation animation

#### 3. TimeSeriesChart Component
- Dynamic time series plotting with configurable time windows (1-300s)
- Customizable display options: grid, line color/width, value display mode
- Built-in low-pass filter for noise reduction

#### 4. Math Modifiers Support
- Full support for Foxglove math modifiers in message paths (23 operations)
- Basic arithmetic: `.@add()`, `.@sub()`, `.@mul()`, `.@div()`
- Mathematical & trigonometric functions: `.@abs`, `.@sqrt`, `.@sin`, `.@cos`, etc.
- Time series operations: `.@delta`, `.@derivative`
- Chain multiple modifiers for complex transformations and unit conversions
