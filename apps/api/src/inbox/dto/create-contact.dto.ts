import {
  IsString,
  IsEmail,
  IsOptional,
  ValidateIf,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

function HasEmailOrPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'hasEmailOrPhone',
      target: (object as { constructor: new (...args: unknown[]) => unknown })
        .constructor,
      propertyName,
      options: {
        message: 'Au moins un email ou un numéro de téléphone est requis',
        ...validationOptions,
      },
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const obj = args.object as CreateContactDto;
          return !!(obj.email?.trim() || obj.phone?.trim());
        },
      },
    });
  };
}

export class CreateContactDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  /** Virtual field used only to carry the cross-field validation error */
  @HasEmailOrPhone()
  @ValidateIf(() => true)
  get _emailOrPhone(): string {
    return this.email || this.phone || '';
  }

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  company?: string;
}
