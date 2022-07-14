import { HexString } from "../hex_string";
import {
  AccountAddress,
  TransactionArgumentAddress,
  TransactionArgumentBool,
  TransactionArgumentU128,
  TransactionArgumentU64,
  TransactionArgumentU8,
  TransactionArgumentU8Vector,
  TypeTagAddress,
  TypeTagBool,
  TypeTagStruct,
  TypeTagU128,
  TypeTagU64,
  TypeTagU8,
  TypeTagVector,
} from "./aptos_types";
import { Serializer } from "./bcs";
import { argToTransactionArgument, parseTypeTag, serializeArg } from "./builder_utils";

describe("BuilderUtils", () => {
  it("parses a bool TypeTag", async () => {
    expect(parseTypeTag("bool") instanceof TypeTagBool).toBeTruthy();
  });

  it("parses a u8 TypeTag", async () => {
    expect(parseTypeTag("u8") instanceof TypeTagU8).toBeTruthy();
  });

  it("parses a u64 TypeTag", async () => {
    expect(parseTypeTag("u64") instanceof TypeTagU64).toBeTruthy();
  });

  it("parses a u128 TypeTag", async () => {
    expect(parseTypeTag("u128") instanceof TypeTagU128).toBeTruthy();
  });

  it("parses a address TypeTag", async () => {
    expect(parseTypeTag("address") instanceof TypeTagAddress).toBeTruthy();
  });

  it("parses a vector TypeTag", async () => {
    const vectorAddress = parseTypeTag("vector<address>");
    expect(vectorAddress instanceof TypeTagVector).toBeTruthy();
    expect((vectorAddress as TypeTagVector).value instanceof TypeTagAddress).toBeTruthy();

    const vectorU64 = parseTypeTag(" vector < u64 > ");
    expect(vectorU64 instanceof TypeTagVector).toBeTruthy();
    expect((vectorU64 as TypeTagVector).value instanceof TypeTagU64).toBeTruthy();
  });

  it("parses a sturct TypeTag", async () => {
    const assertStruct = (struct: TypeTagStruct, accountAddress: string, moduleName: string, structName: string) => {
      expect(HexString.fromUint8Array(struct.value.address.address).toShortString()).toBe(accountAddress);
      expect(struct.value.module_name.value).toBe(moduleName);
      expect(struct.value.name.value).toBe(structName);
    };
    const coin = parseTypeTag("0x1::TestCoin::Coin");
    expect(coin instanceof TypeTagStruct).toBeTruthy();
    assertStruct(coin as TypeTagStruct, "0x1", "TestCoin", "Coin");

    const testCoin = parseTypeTag("0x1::Coin::CoinStore < 0x1::TestCoin::TestCoin1 ,  0x1::TestCoin::TestCoin2 > ");
    expect(testCoin instanceof TypeTagStruct).toBeTruthy();
    assertStruct(testCoin as TypeTagStruct, "0x1", "Coin", "CoinStore");

    const structTypeTags = (testCoin as TypeTagStruct).value.type_args;
    expect(structTypeTags.length).toBe(2);

    const structTypeTag1 = structTypeTags[0];
    assertStruct(structTypeTag1 as TypeTagStruct, "0x1", "TestCoin", "TestCoin1");

    const structTypeTag2 = structTypeTags[1];
    assertStruct(structTypeTag2 as TypeTagStruct, "0x1", "TestCoin", "TestCoin2");

    expect(() => {
      parseTypeTag("0x1::TestCoin");
    }).toThrow("Invalid struct tag string literal.");

    expect(() => {
      parseTypeTag("0x1::TestCoin::CoinStore<0x1::TestCoin::TestCoin");
    }).toThrow("Invalid struct tag string literal.");

    expect(() => {
      parseTypeTag("0x1::TestCoin::CoinStore<0x1::TestCoin>");
    }).toThrow("Invalid struct tag string literal.");
  });

  it("serializes a boolean arg", async () => {
    let serializer = new Serializer();
    serializeArg(true, new TypeTagBool(), serializer);
    expect(serializer.getBytes()).toEqual(new Uint8Array([0x01]));
    serializer = new Serializer();
    expect(() => {
      serializeArg(123, new TypeTagBool(), serializer);
    }).toThrow(/Invalid arg/);
  });

  it("serializes a u8 arg", async () => {
    let serializer = new Serializer();
    serializeArg(255, new TypeTagU8(), serializer);
    expect(serializer.getBytes()).toEqual(new Uint8Array([0xff]));

    serializer = new Serializer();
    expect(() => {
      serializeArg("u8", new TypeTagU8(), serializer);
    }).toThrow(/Invalid arg/);
  });

  it("serializes a u64 arg", async () => {
    let serializer = new Serializer();
    serializeArg(18446744073709551615n, new TypeTagU64(), serializer);
    expect(serializer.getBytes()).toEqual(new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]));

    serializer = new Serializer();
    expect(() => {
      serializeArg("u64", new TypeTagU64(), serializer);
    }).toThrow(/Invalid arg/);
  });

  it("serializes a u128 arg", async () => {
    let serializer = new Serializer();
    serializeArg(340282366920938463463374607431768211455n, new TypeTagU128(), serializer);
    expect(serializer.getBytes()).toEqual(
      new Uint8Array([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]),
    );

    serializer = new Serializer();
    expect(() => {
      serializeArg("u128", new TypeTagU128(), serializer);
    }).toThrow(/Invalid arg/);
  });

  it("serializes an AccountAddress arg", async () => {
    let serializer = new Serializer();
    serializeArg("0x1", new TypeTagAddress(), serializer);
    expect(HexString.fromUint8Array(serializer.getBytes()).toShortString()).toEqual("0x1");

    serializer = new Serializer();
    serializeArg(AccountAddress.fromHex("0x1"), new TypeTagAddress(), serializer);
    expect(HexString.fromUint8Array(serializer.getBytes()).toShortString()).toEqual("0x1");

    serializer = new Serializer();
    expect(() => {
      serializeArg(123456, new TypeTagAddress(), serializer);
    }).toThrow("Invalid account address.");
  });

  it("serializes a vector arg", async () => {
    let serializer = new Serializer();
    serializeArg([255], new TypeTagVector(new TypeTagU8()), serializer);
    expect(serializer.getBytes()).toEqual(new Uint8Array([0x1, 0xff]));

    serializer = new Serializer();
    expect(() => {
      serializeArg(123456, new TypeTagVector(new TypeTagU8()), serializer);
    }).toThrow("Invalid vector args.");
  });

  it("throws at unrecognized arg types", async () => {
    const serializer = new Serializer();
    expect(() => {
      // @ts-ignore
      serializeArg(123456, "unknown_type", serializer);
    }).toThrow("Unsupported arg type.");
  });

  it("converts a boolean TransactionArgument", async () => {
    const res = argToTransactionArgument(true, new TypeTagBool());
    expect((res as TransactionArgumentBool).value).toEqual(true);
    expect(() => {
      argToTransactionArgument(123, new TypeTagBool());
    }).toThrow(/Invalid arg/);
  });

  it("converts a u8 TransactionArgument", async () => {
    const res = argToTransactionArgument(123, new TypeTagU8());
    expect((res as TransactionArgumentU8).value).toEqual(123);
    expect(() => {
      argToTransactionArgument("u8", new TypeTagBool());
    }).toThrow(/Invalid arg/);
  });

  it("converts a u64 TransactionArgument", async () => {
    const res = argToTransactionArgument(123, new TypeTagU64());
    expect((res as TransactionArgumentU64).value).toEqual(123);
    expect(() => {
      argToTransactionArgument("u64", new TypeTagU64());
    }).toThrow(/Invalid arg/);
  });

  it("converts a u128 TransactionArgument", async () => {
    const res = argToTransactionArgument(123, new TypeTagU128());
    expect((res as TransactionArgumentU128).value).toEqual(123);
    expect(() => {
      argToTransactionArgument("u128", new TypeTagU128());
    }).toThrow(/Invalid arg/);
  });

  it("converts an AccountAddress TransactionArgument", async () => {
    let res = argToTransactionArgument("0x1", new TypeTagAddress()) as TransactionArgumentAddress;
    expect(HexString.fromUint8Array(res.value.address).toShortString()).toEqual("0x1");

    res = argToTransactionArgument(AccountAddress.fromHex("0x2"), new TypeTagAddress()) as TransactionArgumentAddress;
    expect(HexString.fromUint8Array(res.value.address).toShortString()).toEqual("0x2");

    expect(() => {
      argToTransactionArgument(123456, new TypeTagAddress());
    }).toThrow("Invalid account address.");
  });

  it("converts a vector TransactionArgument", async () => {
    const res = argToTransactionArgument(
      new Uint8Array([0x1]),
      new TypeTagVector(new TypeTagU8()),
    ) as TransactionArgumentU8Vector;
    expect(res.value).toEqual(new Uint8Array([0x1]));

    expect(() => {
      argToTransactionArgument(123456, new TypeTagVector(new TypeTagU8()));
    }).toThrow(/.*should be an instance of Uint8Array$/);
  });

  it("throws at unrecognized TransactionArgument types", async () => {
    expect(() => {
      // @ts-ignore
      argToTransactionArgument(123456, "unknown_type");
    }).toThrow("Unknown type for TransactionArgument.");
  });
});
