# 3D Model to Litematica Schematic Converter

[https://github.com/zinngar/3d2schematic](https://github.com/zinngar/3d2schematic)

This web application converts 3D models into `.litematic` schematic files for use with the Litematica mod in Minecraft.

## Supported File Types

Currently, this application only supports the **.obj** 3D model format.

## How to Use

1.  **Load a Model**: Click the "Choose File" button to select a `.obj` file from your computer. The model will be displayed in the 3D viewer. You can use your mouse to rotate, pan, and zoom to inspect the model.
2.  **Set the Resolution**: Enter a number in the "Resolution" field to define the size of the voxel grid. A higher number will result in a more detailed schematic but will take longer to process.
3.  **Configure the Block Palette**: The block palette allows you to control which Minecraft blocks are used in the schematic based on the colors of your 3D model.
    *   **Add a Block**: Click the "Add Block" button to add a new entry to the palette.
    *   **Select a Color**: Click the color swatch to open a color picker and choose a color.
    *   **Specify a Block Name**: In the text field, enter the Minecraft ID for the block you want to associate with the selected color (e.g., `minecraft:stone`, `minecraft:dirt`).
    *   **Remove a Block**: Click the "Remove" button next to an entry to delete it.
4.  **Convert**: Once you have configured the settings, click the "Convert to Schematic" button. A "Converting..." message will appear while the application processes the model.
5.  **Download**: When the conversion is complete, the `.litematic` file will be automatically downloaded to your computer. The filename will be based on the name of your original 3D model.

The application works by converting the 3D model into a grid of voxels. For each voxel inside the model, it samples the color of the closest surface on the original model and then finds the closest matching color in your block palette to determine which block to place.
