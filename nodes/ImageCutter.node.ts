import type {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import sharp from 'sharp';

type OperationMode = 'slice' | 'crop';

type Direction = 'horizontal' | 'vertical';

type OutputFormat = 'png' | 'jpg' | 'webp';

type Anchor = 'center' | 'top' | 'bottom' | 'left' | 'right';

const FORMAT_MIME: Record<OutputFormat, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

const FORMAT_SHARP: Record<OutputFormat, 'png' | 'jpeg' | 'webp'> = {
  png: 'png',
  jpg: 'jpeg',
  webp: 'webp',
};

const getAnchoredX = (anchor: Anchor, imageWidth: number, cropWidth: number): number => {
  switch (anchor) {
    case 'left':
      return 0;
    case 'right':
      return imageWidth - cropWidth;
    default:
      return Math.floor((imageWidth - cropWidth) / 2);
  }
};

const getAnchoredY = (anchor: Anchor, imageHeight: number, cropHeight: number): number => {
  switch (anchor) {
    case 'top':
      return 0;
    case 'bottom':
      return imageHeight - cropHeight;
    default:
      return Math.floor((imageHeight - cropHeight) / 2);
  }
};

export class ImageCutter implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Image Cutter & Cropper',
    name: 'imageCutter',
    icon: 'fa:cut',
    group: ['transform'],
    version: 1,
    description: 'Slice or crop images from binary data',
    defaults: {
      name: 'Image Cutter & Cropper',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Binary Property',
        name: 'binaryProperty',
        type: 'string',
        default: 'data',
        required: true,
        description: 'Name of the binary property containing the image',
      },
      {
        displayName: 'Operation Mode',
        name: 'operation',
        type: 'options',
        options: [
          {
            name: 'Slice',
            value: 'slice',
          },
          {
            name: 'Crop',
            value: 'crop',
          },
        ],
        default: 'slice',
      },
      {
        displayName: 'Direction',
        name: 'direction',
        type: 'options',
        options: [
          {
            name: 'Horizontal',
            value: 'horizontal',
          },
          {
            name: 'Vertical',
            value: 'vertical',
          },
        ],
        default: 'horizontal',
        displayOptions: {
          show: {
            operation: ['slice'],
          },
        },
      },
      {
        displayName: 'Output Format',
        name: 'outputFormat',
        type: 'options',
        options: [
          {
            name: 'PNG',
            value: 'png',
          },
          {
            name: 'JPG',
            value: 'jpg',
          },
          {
            name: 'WebP',
            value: 'webp',
          },
        ],
        default: 'png',
      },
      {
        displayName: 'File Name Prefix',
        name: 'fileNamePrefix',
        type: 'string',
        default: 'image_',
      },
      {
        displayName: 'Start Index',
        name: 'startIndex',
        type: 'number',
        default: 1,
        typeOptions: {
          minValue: 0,
        },
      },
      {
        displayName: 'Number of Slices',
        name: 'numberOfSlices',
        type: 'number',
        default: 4,
        typeOptions: {
          minValue: 1,
        },
        displayOptions: {
          show: {
            operation: ['slice'],
          },
        },
      },
      {
        displayName: 'Slice Width',
        name: 'sliceWidth',
        type: 'number',
        default: 0,
        typeOptions: {
          minValue: 0,
        },
        description: 'Fixed width per slice (0 = auto)',
        displayOptions: {
          show: {
            operation: ['slice'],
          },
        },
      },
      {
        displayName: 'Slice Height',
        name: 'sliceHeight',
        type: 'number',
        default: 0,
        typeOptions: {
          minValue: 0,
        },
        description: 'Fixed height per slice (0 = auto)',
        displayOptions: {
          show: {
            operation: ['slice'],
          },
        },
      },
      {
        displayName: 'Allow Remainder',
        name: 'allowRemainder',
        type: 'boolean',
        default: false,
        displayOptions: {
          show: {
            operation: ['slice'],
          },
        },
      },
      {
        displayName: 'Crop Width',
        name: 'cropWidth',
        type: 'number',
        default: 0,
        typeOptions: {
          minValue: 1,
        },
        displayOptions: {
          show: {
            operation: ['crop'],
          },
        },
      },
      {
        displayName: 'Crop Height',
        name: 'cropHeight',
        type: 'number',
        default: 0,
        typeOptions: {
          minValue: 1,
        },
        displayOptions: {
          show: {
            operation: ['crop'],
          },
        },
      },
      {
        displayName: 'Crop X',
        name: 'cropX',
        type: 'number',
        default: -1,
        description: 'Horizontal position (-1 = auto)',
        displayOptions: {
          show: {
            operation: ['crop'],
          },
        },
      },
      {
        displayName: 'Crop Y',
        name: 'cropY',
        type: 'number',
        default: -1,
        description: 'Vertical position (-1 = auto)',
        displayOptions: {
          show: {
            operation: ['crop'],
          },
        },
      },
      {
        displayName: 'Anchor',
        name: 'anchor',
        type: 'options',
        options: [
          {
            name: 'Center',
            value: 'center',
          },
          {
            name: 'Top',
            value: 'top',
          },
          {
            name: 'Bottom',
            value: 'bottom',
          },
          {
            name: 'Left',
            value: 'left',
          },
          {
            name: 'Right',
            value: 'right',
          },
        ],
        default: 'center',
        displayOptions: {
          show: {
            operation: ['crop'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const binaryProperty = this.getNodeParameter('binaryProperty', itemIndex) as string;
      const operation = this.getNodeParameter('operation', itemIndex) as OperationMode;
      const outputFormat = this.getNodeParameter('outputFormat', itemIndex) as OutputFormat;
      const fileNamePrefix = this.getNodeParameter('fileNamePrefix', itemIndex) as string;
      const startIndex = this.getNodeParameter('startIndex', itemIndex) as number;

      const binaryItem = items[itemIndex].binary?.[binaryProperty];
      if (!binaryItem) {
        throw new NodeOperationError(
          this.getNode(),
          `Binary property "${binaryProperty}" is missing`,
          { itemIndex },
        );
      }

      const imageBuffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryProperty);
      const imageSharp = sharp(imageBuffer, { failOnError: true });
      const metadata = await imageSharp.metadata();

      if (!metadata.format || !metadata.width || !metadata.height) {
        throw new NodeOperationError(this.getNode(), 'Unable to read image metadata', {
          itemIndex,
        });
      }

      if (!['jpeg', 'png', 'webp'].includes(metadata.format)) {
        throw new NodeOperationError(this.getNode(), `Unsupported image format: ${metadata.format}`, {
          itemIndex,
        });
      }

      const imageWidth = metadata.width;
      const imageHeight = metadata.height;

      if (operation === 'slice') {
        const numberOfSlices = this.getNodeParameter('numberOfSlices', itemIndex) as number;
        const direction = this.getNodeParameter('direction', itemIndex) as Direction;
        const sliceWidthParam = this.getNodeParameter('sliceWidth', itemIndex) as number;
        const sliceHeightParam = this.getNodeParameter('sliceHeight', itemIndex) as number;
        const allowRemainder = this.getNodeParameter('allowRemainder', itemIndex) as boolean;

        if (numberOfSlices < 1) {
          throw new NodeOperationError(this.getNode(), 'Number of slices must be at least 1', {
            itemIndex,
          });
        }

        let sliceWidth = sliceWidthParam > 0 ? sliceWidthParam : imageWidth;
        let sliceHeight = sliceHeightParam > 0 ? sliceHeightParam : imageHeight;

        if (direction === 'horizontal') {
          sliceWidth = sliceWidthParam > 0 ? sliceWidthParam : Math.floor(imageWidth / numberOfSlices);
          sliceHeight = sliceHeightParam > 0 ? sliceHeightParam : imageHeight;

          if (sliceWidth < 1) {
            throw new NodeOperationError(
              this.getNode(),
              'Slice width is too small for the selected number of slices',
              { itemIndex },
            );
          }

          const totalWidth = sliceWidth * numberOfSlices;
          const remainder = imageWidth - totalWidth;
          if (totalWidth > imageWidth) {
            throw new NodeOperationError(
              this.getNode(),
              'Slice width and number of slices exceed image width',
              { itemIndex },
            );
          }

          if (!allowRemainder && remainder !== 0) {
            throw new NodeOperationError(
              this.getNode(),
              'Image width is not divisible by number of slices',
              { itemIndex },
            );
          }

          for (let sliceIndex = 0; sliceIndex < numberOfSlices; sliceIndex += 1) {
            const remainderOffset = allowRemainder && sliceIndex === numberOfSlices - 1 ? remainder : 0;
            const sliceWidthWithRemainder = sliceWidth + remainderOffset;
            const left = sliceIndex * sliceWidth;
            const top = 0;

            if (sliceHeight > imageHeight) {
              throw new NodeOperationError(this.getNode(), 'Slice height exceeds image height', {
                itemIndex,
              });
            }

            const buffer = await imageSharp
              .clone()
              .extract({
                left,
                top,
                width: sliceWidthWithRemainder,
                height: sliceHeight,
              })
              .toFormat(FORMAT_SHARP[outputFormat])
              .toBuffer();

            const fileIndex = startIndex + sliceIndex;
            const fileName = `${fileNamePrefix}${fileIndex}.${outputFormat}`;

            const binaryData = await this.helpers.prepareBinaryData(buffer, fileName, FORMAT_MIME[outputFormat]);
            returnData.push({
              json: {
                index: fileIndex,
                width: sliceWidthWithRemainder,
                height: sliceHeight,
                operation: 'slice',
              },
              binary: {
                image: binaryData,
              },
            });
          }
        } else {
          sliceHeight = sliceHeightParam > 0 ? sliceHeightParam : Math.floor(imageHeight / numberOfSlices);
          sliceWidth = sliceWidthParam > 0 ? sliceWidthParam : imageWidth;

          if (sliceHeight < 1) {
            throw new NodeOperationError(
              this.getNode(),
              'Slice height is too small for the selected number of slices',
              { itemIndex },
            );
          }

          const totalHeight = sliceHeight * numberOfSlices;
          const remainder = imageHeight - totalHeight;
          if (totalHeight > imageHeight) {
            throw new NodeOperationError(
              this.getNode(),
              'Slice height and number of slices exceed image height',
              { itemIndex },
            );
          }

          if (!allowRemainder && remainder !== 0) {
            throw new NodeOperationError(
              this.getNode(),
              'Image height is not divisible by number of slices',
              { itemIndex },
            );
          }

          for (let sliceIndex = 0; sliceIndex < numberOfSlices; sliceIndex += 1) {
            const remainderOffset = allowRemainder && sliceIndex === numberOfSlices - 1 ? remainder : 0;
            const sliceHeightWithRemainder = sliceHeight + remainderOffset;
            const left = 0;
            const top = sliceIndex * sliceHeight;

            if (sliceWidth > imageWidth) {
              throw new NodeOperationError(this.getNode(), 'Slice width exceeds image width', {
                itemIndex,
              });
            }

            const buffer = await imageSharp
              .clone()
              .extract({
                left,
                top,
                width: sliceWidth,
                height: sliceHeightWithRemainder,
              })
              .toFormat(FORMAT_SHARP[outputFormat])
              .toBuffer();

            const fileIndex = startIndex + sliceIndex;
            const fileName = `${fileNamePrefix}${fileIndex}.${outputFormat}`;

            const binaryData = await this.helpers.prepareBinaryData(buffer, fileName, FORMAT_MIME[outputFormat]);
            returnData.push({
              json: {
                index: fileIndex,
                width: sliceWidth,
                height: sliceHeightWithRemainder,
                operation: 'slice',
              },
              binary: {
                image: binaryData,
              },
            });
          }
        }
      }

      if (operation === 'crop') {
        const cropWidth = this.getNodeParameter('cropWidth', itemIndex) as number;
        const cropHeight = this.getNodeParameter('cropHeight', itemIndex) as number;
        const cropX = this.getNodeParameter('cropX', itemIndex) as number;
        const cropY = this.getNodeParameter('cropY', itemIndex) as number;
        const anchor = this.getNodeParameter('anchor', itemIndex) as Anchor;

        if (cropWidth <= 0 || cropHeight <= 0) {
          throw new NodeOperationError(this.getNode(), 'Crop width and height are required', {
            itemIndex,
          });
        }

        if (cropWidth > imageWidth || cropHeight > imageHeight) {
          throw new NodeOperationError(this.getNode(), 'Crop dimensions exceed image dimensions', {
            itemIndex,
          });
        }

        const computedX = cropX >= 0 ? cropX : getAnchoredX(anchor, imageWidth, cropWidth);
        const computedY = cropY >= 0 ? cropY : getAnchoredY(anchor, imageHeight, cropHeight);

        if (computedX < 0 || computedY < 0) {
          throw new NodeOperationError(this.getNode(), 'Crop position is outside the image', {
            itemIndex,
          });
        }

        if (computedX + cropWidth > imageWidth || computedY + cropHeight > imageHeight) {
          throw new NodeOperationError(this.getNode(), 'Crop area exceeds image boundaries', {
            itemIndex,
          });
        }

        const buffer = await imageSharp
          .clone()
          .extract({
            left: Math.floor(computedX),
            top: Math.floor(computedY),
            width: Math.floor(cropWidth),
            height: Math.floor(cropHeight),
          })
          .toFormat(FORMAT_SHARP[outputFormat])
          .toBuffer();

        const fileIndex = startIndex;
        const fileName = `${fileNamePrefix}${fileIndex}.${outputFormat}`;
        const binaryData = await this.helpers.prepareBinaryData(buffer, fileName, FORMAT_MIME[outputFormat]);

        returnData.push({
          json: {
            index: fileIndex,
            width: cropWidth,
            height: cropHeight,
            operation: 'crop',
          },
          binary: {
            image: binaryData,
          },
        });
      }
    }

    return [returnData];
  }

}
