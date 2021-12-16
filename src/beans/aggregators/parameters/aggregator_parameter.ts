abstract class AggregatorParameter {
  name: string;
  text: string;
  value: string;
  type: AggregatorParameterType;

  constructor(name: string, text: string = name, value: string) {
    this.name = name;
    this.text = text;
    this.value = value;
    this.type = 'sampling';
  }
}

export type AggregatorParameterType = 'alignment' | 'any' | 'enum' | 'limited' | 'sampling' | 'sampling_unit';
export { AggregatorParameter };
